import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The container image runs `.next/standalone/server.js`, a traced copy of only
  // what the server needs. It is opt-in, set by the Dockerfile, because
  // `next start` does not work with it and `npm run dev` / `npm run start`
  // should stay exactly what they were.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
