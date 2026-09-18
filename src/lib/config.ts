import { z } from 'zod';

/**
 * Configuration, read once and validated (the house rule: new configuration
 * goes through `.env` and a typed reader, never a literal in a component).
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time by *literal text
 * match*, so each variable has to be written out in full below. A computed
 * lookup like `process.env[name]` reads undefined in the browser, which is the
 * kind of bug that only shows up in a production build.
 */
const schema = z.object({
  apiBaseUrl: z.url(),
  realtimeUrl: z.union([z.url(), z.literal('')]),
  realtimePath: z.string().startsWith('/'),
  appName: z.string().min(1),
});

export type Config = z.infer<typeof schema>;

const parsed = schema.safeParse({
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1',
  realtimeUrl: process.env.NEXT_PUBLIC_REALTIME_URL ?? '',
  realtimePath: process.env.NEXT_PUBLIC_REALTIME_PATH ?? '/realtime',
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'ChargeVeta',
});

if (!parsed.success) {
  // Thrown at import time on purpose. A console that starts with a broken API
  // address fails later, on a screen, as something that looks like the API
  // being down.
  throw new Error(
    `The console is misconfigured. Check .env.local: ${z.prettifyError(parsed.error)}`,
  );
}

export const config: Config = parsed.data;

/** Whether this build was given a realtime endpoint to connect to. */
export const realtimeEnabled = config.realtimeUrl !== '';
