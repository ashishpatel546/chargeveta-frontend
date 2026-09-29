import type { NextConfig } from "next";

/**
 * Hostnames, besides localhost, that the dev server lets a page load its dev
 * resources from — `/_next/*` and the hot-reload socket. Next 16 refuses those
 * with a 403 from any other origin, which is what breaks `npm run dev` opened
 * through a tunnel (a phone on https://charveta.appme.in, say) while the same
 * page on localhost works. Comma-separated hostnames, `*.` wildcards allowed;
 * set it empty to allow localhost only. Development only — `next build` and
 * `next start` never read it.
 */
const allowedDevOrigins = (
  process.env.DEV_ALLOWED_ORIGINS ?? "charveta.appme.in"
)
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // The container image runs `.next/standalone/server.js`, a traced copy of only
  // what the server needs. It is opt-in, set by the Dockerfile, because
  // `next start` does not work with it and `npm run dev` / `npm run start`
  // should stay exactly what they were.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  allowedDevOrigins,
  // The service worker decides which build a phone runs, so it must never be
  // served from a cache. Next sends `max-age=0` for public files, and a CDN's
  // browser-cache setting may raise that: through the dev tunnel, Cloudflare
  // turned both `max-age=0` and `no-cache` into four hours. `no-store` is the
  // one value it passes through untouched.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
