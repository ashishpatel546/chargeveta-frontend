import 'server-only';

import { cookies } from 'next/headers';
import { config } from '../config';

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
const ACCESS_COOKIE = 'cv_at';
const REFRESH_COOKIE = 'cv_rt';

/** The name the realtime socket and the proxy both use when the pair is gone. */
export const SESSION_COOKIES = [ACCESS_COOKIE, REFRESH_COOKIE] as const;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
}

/**
 * A cookie's settings.
 *
 * `secure` follows the deployment rather than being hard-coded: a secure cookie
 * is never sent over plain http, so hard-coding it on would break every local
 * run, and hard-coding it off would ship a token over the wire in production.
 */
function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/**
 * The refresh cookie outlives the access token by a long way — the API's
 * default idle window is fourteen days — because it is what lets a console
 * left open overnight come back without a sign-in.
 */
const REFRESH_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function writeSession(pair: TokenPair): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, pair.accessToken, cookieOptions(pair.expiresInSeconds));
  jar.set(
    REFRESH_COOKIE,
    pair.refreshToken,
    cookieOptions(REFRESH_MAX_AGE_SECONDS),
  );
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  for (const name of SESSION_COOKIES) jar.delete(name);
}

/**
 * Exchanges the refresh token for a new pair.
 *
 * Returns null on any refusal, which the caller turns into a sign-in. The
 * refresh token is single use, so a refused refresh is not worth retrying: the
 * API revokes the whole session when a replaced token is presented again,
 * except inside its ten-second grace window.
 */
export async function refreshTokens(
  refreshToken: string,
): Promise<TokenPair | null> {
  const response = await fetch(`${config.apiBaseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.json()) as TokenPair;
}
