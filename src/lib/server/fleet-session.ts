import 'server-only';

import { cookies } from 'next/headers';
import { clientHeaders } from './client-address';
import {
  requestRefresh,
  sessionCookies,
  FLEET_SURFACE,
  type RefreshResult,
  type StoredSession,
  type TokenPair,
} from './session-surfaces';

/**
 * Where a fleet manager's tokens live — `driver-session.ts` again, in a third
 * cookie pair.
 *
 * A fleet manager is a third principal kind on the API (`charveta` doc 6 §23:
 * its own table, sessions, token audience and refresh endpoint), so it gets
 * cookies of its own. One browser can hold a staff, a driver and a fleet
 * session at once without any of them signing another out.
 */
const SURFACE = FLEET_SURFACE;

export const FLEET_SESSION_COOKIES = [
  SURFACE.accessCookie,
  SURFACE.refreshCookie,
] as const;

export type FleetTokenPair = TokenPair;
export type FleetSession = StoredSession;

/**
 * The session the cookies hold, or null when nobody is signed in — decided by
 * the refresh cookie, since the access cookie lapses with its short-lived
 * token long before the session does (`session.ts`'s `readSession`).
 */
export async function readFleetSession(): Promise<FleetSession | null> {
  const jar = await cookies();
  const refreshToken = jar.get(SURFACE.refreshCookie)?.value;
  if (!refreshToken) return null;
  return { accessToken: jar.get(SURFACE.accessCookie)?.value, refreshToken };
}

/** Route Handlers and Server Actions only — see `session.ts`'s `writeSession`. */
export async function writeFleetSession(pair: FleetTokenPair): Promise<void> {
  const jar = await cookies();
  for (const cookie of sessionCookies(SURFACE, pair)) jar.set(cookie);
}

export async function clearFleetSession(): Promise<void> {
  const jar = await cookies();
  for (const name of FLEET_SESSION_COOKIES) jar.delete(name);
}

/** Exchanges a refresh token for a new pair — single use, as for staff. */
export async function refreshFleetTokens(
  refreshToken: string,
): Promise<RefreshResult> {
  return requestRefresh(SURFACE, refreshToken, await clientHeaders());
}
