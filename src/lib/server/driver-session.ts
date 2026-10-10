import 'server-only';

import { cookies } from 'next/headers';
import { clientHeaders } from './client-address';
import {
  requestRefresh,
  sessionCookies,
  DRIVER_SURFACE,
  type RefreshResult,
  type StoredSession,
  type TokenPair,
} from './session-surfaces';

/**
 * Where a driver's tokens live — the same idea as `session.ts`, in cookies of
 * their own.
 *
 * A driver and a staff member are different principal kinds on the API
 * (`kind: 'driver'` vs `kind: 'user'`, different token audiences, different
 * refresh endpoints — `charveta` doc 6 §22.3), so they get a second cookie
 * pair rather than sharing one. That also means one browser can hold both at
 * once without either signing the other out — a developer testing both, or an
 * operator who is also a driver of their own fleet.
 */
const SURFACE = DRIVER_SURFACE;

export const DRIVER_SESSION_COOKIES = [
  SURFACE.accessCookie,
  SURFACE.refreshCookie,
] as const;

export type DriverTokenPair = TokenPair;
export type DriverSession = StoredSession;

/**
 * The session the cookies hold, or null when nobody is signed in — decided by
 * the refresh cookie, since the access cookie lapses with its short-lived
 * token long before the session does (`session.ts`'s `readSession`).
 */
export async function readDriverSession(): Promise<DriverSession | null> {
  const jar = await cookies();
  const refreshToken = jar.get(SURFACE.refreshCookie)?.value;
  if (!refreshToken) return null;
  return { accessToken: jar.get(SURFACE.accessCookie)?.value, refreshToken };
}

/** Route Handlers and Server Actions only — see `session.ts`'s `writeSession`. */
export async function writeDriverSession(pair: DriverTokenPair): Promise<void> {
  const jar = await cookies();
  for (const cookie of sessionCookies(SURFACE, pair)) jar.set(cookie);
}

export async function clearDriverSession(): Promise<void> {
  const jar = await cookies();
  for (const name of DRIVER_SESSION_COOKIES) jar.delete(name);
}

/** Exchanges a refresh token for a new pair — single use, as for staff. */
export async function refreshDriverTokens(
  refreshToken: string,
): Promise<RefreshResult> {
  return requestRefresh(SURFACE, refreshToken, await clientHeaders());
}
