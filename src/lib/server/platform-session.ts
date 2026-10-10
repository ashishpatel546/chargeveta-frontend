import 'server-only';

import { cookies } from 'next/headers';
import { clientHeaders } from './client-address';
import {
  requestRefresh,
  sessionCookies,
  PLATFORM_SURFACE,
  type RefreshResult,
  type StoredSession,
  type TokenPair,
} from './session-surfaces';

/**
 * Where a platform administrator's tokens live — `fleet-session.ts` again, in
 * a fourth cookie pair.
 *
 * A platform admin is not a tenant's user at all: they sit above every
 * operator, on their own table, sessions, token audience and refresh endpoint
 * (`/platform/auth/*`). Their own cookies mean a browser can hold a staff and
 * a platform session side by side without either signing the other out — and,
 * more to the point, that nothing the staff console's proxy forwards could
 * ever carry a platform token.
 */
const SURFACE = PLATFORM_SURFACE;

export const PLATFORM_SESSION_COOKIES = [
  SURFACE.accessCookie,
  SURFACE.refreshCookie,
] as const;

export type PlatformTokenPair = TokenPair;
export type PlatformSession = StoredSession;

/**
 * The session the cookies hold, or null when nobody is signed in — decided by
 * the refresh cookie, since the access cookie lapses with its short-lived
 * token long before the session does (`session.ts`'s `readSession`).
 */
export async function readPlatformSession(): Promise<PlatformSession | null> {
  const jar = await cookies();
  const refreshToken = jar.get(SURFACE.refreshCookie)?.value;
  if (!refreshToken) return null;
  return { accessToken: jar.get(SURFACE.accessCookie)?.value, refreshToken };
}

/** Route Handlers and Server Actions only — see `session.ts`'s `writeSession`. */
export async function writePlatformSession(pair: PlatformTokenPair): Promise<void> {
  const jar = await cookies();
  for (const cookie of sessionCookies(SURFACE, pair)) jar.set(cookie);
}

export async function clearPlatformSession(): Promise<void> {
  const jar = await cookies();
  for (const name of PLATFORM_SESSION_COOKIES) jar.delete(name);
}

/** Exchanges a refresh token for a new pair — single use, as for staff. */
export async function refreshPlatformTokens(
  refreshToken: string,
): Promise<RefreshResult> {
  return requestRefresh(SURFACE, refreshToken, await clientHeaders());
}
