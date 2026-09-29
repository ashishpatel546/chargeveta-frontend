# ChargeVeta console

The web front end for ChargeVeta: the operator and administrator console today,
and the home of the fleet and driver screens as those are built.

It is a Next.js application (App Router, TypeScript, Tailwind, shadcn/ui on Base
UI) and an installable progressive web app. It holds no data of its own — every
screen is a view of the ChargeVeta API.

## Running it

You need the API running first. In `charveta`:

```
docker compose -f docker-compose.dev.yml up -d   # Postgres and Redis
npm run start:dev                                 # the API, on :9010
npm run start:worker:dev                          # the event worker
```

Then here:

```
cp .env.example .env.local     # and edit if your API is not on :9010
npm install
npm run dev                    # http://localhost:9014 (https://charveta.appme.in)
```

A platform admin creates each tenant and its owner at `/platform/tenants`
(the first platform admin comes from `PLATFORM_ADMIN_EMAIL` and
`PLATFORM_ADMIN_INITIAL_PASSWORD` in the API's `.env`). Staff then sign in at
`/sign-in` with the tenant's short name, their email and password; a forgotten
password is reset from **Forgot password?** there (`/sign-in/forgot`).

### From another device

The dev server can be opened from a phone or another laptop through a tunnel —
the owner's is `https://charveta.appme.in` → `localhost:9014`, with `/realtime`
routed to the API (see "Opening the dev stack from another device" in the
charveta README). Next 16 refuses its own dev resources (`/_next/*`, hot reload)
to any origin but localhost unless it is listed, so `next.config.ts` allows the
hostnames in `DEV_ALLOWED_ORIGINS` (comma-separated, default
`charveta.appme.in`; empty allows localhost only). Server Actions, cookies, the
manifest and the service worker need nothing: the tunnel keeps the `Host`
header, the session cookies are `Secure` only in production builds, and web
push works because the hostname is https.

### In Docker

`Dockerfile` builds a small standalone image (`output: 'standalone'`, set only by
the Dockerfile, so `npm run dev` and `npm run start` are unchanged). Two kinds of
setting, and they behave differently:

- **`API_BASE_URL`** is read when the server starts. It is where the console's own
  proxy forwards to — inside Docker a service name, `http://api:9010/api/v1` — and
  it wins over `NEXT_PUBLIC_API_BASE_URL` on the server.
- **`NEXT_PUBLIC_*`** is inlined into the browser bundle by `next build`, so it is
  a build argument, not something a running container can change. The one that
  matters is `NEXT_PUBLIC_REALTIME_URL`, which the *browser* dials: build with
  `--build-arg NEXT_PUBLIC_REALTIME_URL=…` if you publish the API somewhere other
  than `http://localhost:9010`. Without it the console works and says "not live".

```
docker build -t chargeveta/console .
docker run -p 9014:9014 -e API_BASE_URL=http://host.docker.internal:9010/api/v1 chargeveta/console
```

The whole platform, this image included, runs from
`charveta/deploy/docker/docker-compose-full.yml`.

| Script | What it does |
|---|---|
| `npm run dev` | Development server on 9014 |
| `npm run build` | Production build |
| `npm run start` | Serves the build on 9014 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## How it talks to the API

Two decisions shape everything else here.

**Nothing in the browser holds a token.** Signing in puts the access and refresh
tokens in `httpOnly` cookies, and every API call the browser makes goes to this
app's own `/api/cv/...`, which attaches the token and forwards it
(`src/app/api/cv/[...path]/route.ts`). A 401 is refreshed and retried once,
there, so no screen has to know the refresh rules. The refresh token never
reaches the page.

**That is also the only way in.** The API sends no CORS headers at all, so a
browser cannot call it across origins. Going through this app is not a
convenience; it is what makes the console possible without loosening the API.

The one exception is live updates. The API's Socket.IO endpoint is a WebSocket
straight from the browser, and its handshake wants the token, so
`/api/realtime-token` hands over the *access* token — and only that — for the
socket to use. The API must be started with `REALTIME_ENABLED=true` and this
app's origin in `REALTIME_CORS_ORIGINS`. Without it the console still works; it
refetches on an interval instead, and the header says "not live".

The browser dials `NEXT_PUBLIC_REALTIME_URL` — except when that names
localhost and the page is not on localhost, i.e. the console opened from another
device through a tunnel. There `localhost` would be the phone, so the socket
goes to the page's own origin at the same path (`realtimeUrlFor` in
`src/lib/config.ts`), and the tunnel routes that path to the API. Same origin,
wss under https, no CORS.

The socket's messages are thin on purpose: ids and what changed, never an
entity. `src/components/realtime-provider.tsx` therefore does not patch the
cache — it marks the affected queries stale and lets them refetch through the
proxy, where the API's roles still apply.

## Layout

```
src/app/(console)/     the screens behind a sign-in
src/app/api/cv/        the proxy to the API
src/app/sign-in/       the only page in front of it
src/components/        shared pieces; components/ui is shadcn's, don't hand-edit
src/lib/api/           the API's shapes and the browser's client
src/lib/server/        session cookies, server-side API calls, sign-in actions
```

## Things worth knowing before changing anything

- **Money and energy are decimal strings.** The API sends money in minor units
  and energy in watt-hours, as strings, because they are `numeric` in Postgres.
  Format them with `src/lib/format.ts`; never do arithmetic on them and send the
  result back. Pricing belongs to the API, which has the tariff and the tax
  rules.
- **A remote command answers 200 whatever happened.** The charger's refusal, a
  timeout, the charger being offline: all of it is in the body's `outcome`, not
  in the status code. `delivered` is the field that matters before retrying —
  a command that arrived and then timed out may have been carried out.
- **Role checks here only hide things.** `useCan('admin')` decides what to show.
  The API decides what happens. Do not let the two drift into the console being
  the thing that enforces.
- **This shadcn build sits on Base UI, not Radix.** There is no `asChild`; use
  the `render` prop. `Select`'s `onValueChange` gives `string | null`.
- **Configuration goes through `.env` and `src/lib/config.ts`**, which validates
  it at import. Next inlines `NEXT_PUBLIC_*` by literal text match, so each one
  has to be written out in full there — a computed lookup reads undefined in the
  browser.

## The progressive web app

`public/sw.js` is written by hand rather than generated: the usual generator for
Next does not support Turbopack, which is Next 16's default bundler. It caches
the hashed build assets and an offline page, and it never caches an API
response — a cached answer to "is this charger live?" is worse than no answer.

It also shows **web pushes** (charveta doc 6 §22.2): warning and critical alerts,
delivered while the console is closed. Anyone turns them on for a browser under
Settings → *Alerts on this device*; the API needs its VAPID keys set
(`npm run vapid:keys` in charveta) or the card says push is unavailable. The
worker registers only in production, so in development turning push on
registers `/sw.js?mode=push-only`, which shows pushes and leaves every request
alone — the asset cache is what makes a worker a nuisance while developing.

## Invitations and email

An invited person, or one whose password an admin resets, gets an email with a
link to **`/setup?token=…`**, where they choose a password and are signed in.
The page is public (the middleware lets it through) and does not check the
token before submit, because a validity check would be an oracle for guessing
tokens. The invite and reset dialogs say whether an email actually went
(`emailQueued` from the API) and show the same link to pass on by hand. Admins
see every email, SMS and push, and why any was not sent, under **Messages**.

The icons are drawn at request time by `src/app/icons/[size]/route.tsx` rather
than stored, so there is one drawing and no binaries in the repository.
