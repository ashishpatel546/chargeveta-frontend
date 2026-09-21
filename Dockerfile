# syntax=docker/dockerfile:1
#
# The operator and admin console, in the pattern of the other two images:
# multi-stage, tini as PID 1, the base image's unprivileged user, configuration
# from environment variables.
#
#   docker build -t chargeveta/console .
#   docker run -p 9014:9014 -e API_BASE_URL=http://api:9010/api/v1 chargeveta/console
#
# `.dockerignore` is an allowlist, so `.env.local` never enters the build
# context and nothing here copies one in.
#
# What is fixed at build time and what is not:
#
#   * `API_BASE_URL` is read by the server when it starts. It is where the
#     console's own proxy (`/api/cv`) forwards to, and inside Docker it is a
#     service name (`http://api:9010/api/v1`), not what a browser would use.
#   * `NEXT_PUBLIC_*` is inlined into the browser bundle by `next build`, so it
#     is a build argument and cannot be changed by running the image with a
#     different environment. The one that matters is `NEXT_PUBLIC_REALTIME_URL`:
#     the *browser* dials it, so it is the API as the browser reaches it. The
#     default assumes the API is published on localhost:9010 (the full stack's
#     default); if you publish it elsewhere, rebuild with
#     `--build-arg NEXT_PUBLIC_REALTIME_URL=…`. Without it the console still
#     works and says "not live", refetching on an interval.

ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json next.config.ts postcss.config.mjs ./
COPY public ./public
COPY src ./src

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:9010/api/v1
ARG NEXT_PUBLIC_REALTIME_URL=http://localhost:9010
ARG NEXT_PUBLIC_REALTIME_PATH=/realtime
ARG NEXT_PUBLIC_APP_NAME=ChargeVeta
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_REALTIME_URL=${NEXT_PUBLIC_REALTIME_URL} \
    NEXT_PUBLIC_REALTIME_PATH=${NEXT_PUBLIC_REALTIME_PATH} \
    NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM ${NODE_IMAGE}

# An init as PID 1, so node is not: a SIGTERM that arrives before node installs
# its handlers is otherwise dropped, and `docker stop` waits out its grace
# period. The same reasoning as the monolith and the engine.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*
ENTRYPOINT ["/usr/bin/tini", "--"]

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=9014 \
    HOSTNAME=0.0.0.0
WORKDIR /app

# `output: 'standalone'` traces only the files the server needs and writes a
# minimal `server.js`. It leaves out `public` and `.next/static` on purpose (a
# CDN would normally serve them), so they are copied in beside it.
# `--chown` because /app is not writable by the runtime user, and Next writes
# its cache under `.next`.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node

# The default of `PORT`; if you set it at run time, publish the port you set.
EXPOSE 9014

CMD ["node", "server.js"]
