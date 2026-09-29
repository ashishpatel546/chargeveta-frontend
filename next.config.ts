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
};

export default nextConfig;
