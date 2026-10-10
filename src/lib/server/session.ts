import 'server-only';

import { cookies } from 'next/headers';
import { clientHeaders } from './client-address';
import {
  requestRefresh,
  sessionCookies,
  STAFF_SURFACE,
  type RefreshResult,
  type StoredSession,
  type TokenPair,
} from './session-surfaces';

/**
 * Where the tokens live.
 *
 * The API hands out a 15-minute access token and a single-use refresh token,
 * and sets no cookies of its own (doc 6 §9): the client owns them. This console
 * keeps them in `httpOnly` cookies and talks to the API through a proxy of its
 * own (`/api/cv/*`) rather than from the browser, for two reasons.
 *
 * 1. Nothing the page runs can read a token. `localStorage` is readable by any
 *    script that gets onto the page, and a stolen refresh token is good for two
 *    weeks.
 * 2. The API sets no CORS headers at all, so a browser cannot call it across
 *    origins anyway. Same-origin through this app is the only way in that does
 *    not mean loosening the API.
 */
const SURFACE = STAFF_SURFACE;

/** The name the realtime socket and the proxy both use when the pair is gone. */
export const SESSION_COOKIES = [
  SURFACE.accessCookie,
  SURFACE.refreshCookie,
] as const;

export type { TokenPair };
export type Session = StoredSession;

/**
 * The session the cookies hold, or null when nobody is signed in.
 *
 * The refresh cookie decides that, not the access cookie: the access cookie
 * expires with its fifteen-minute token, and a console left alone that long is
 * still signed in — it just needs a refresh before its next call.
 */
export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const refreshToken = jar.get(SURFACE.refreshCookie)?.value;
  if (!refreshToken) return null;
  return { accessToken: jar.get(SURFACE.accessCookie)?.value, refreshToken };
}

/**
 * Stores a token pair. The refresh cookie lasts as long as the API says the
 * refresh token does, which is what lets a console left open overnight come
 * back without a sign-in.
 *
 * Only a Route Handler or Server Action can do this; a Server Component
 * cannot set a cookie, which is why pages are refreshed in `proxy.ts`.
 */
export async function writeSession(pair: TokenPair): Promise<void> {
  const jar = await cookies();
  for (const cookie of sessionCookies(SURFACE, pair)) jar.set(cookie);
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  for (const name of SESSION_COOKIES) jar.delete(name);
}

/**
 * Exchanges the refresh token for a new pair.
 *
 * The refresh token is single use, so a refused refresh is not worth retrying:
 * the API revokes the whole session when a replaced token is presented again,
 * except inside its ten-second grace window.
 */
export async function refreshTokens(
  refreshToken: string,
): Promise<RefreshResult> {
  return requestRefresh(SURFACE, refreshToken, await clientHeaders());
}
