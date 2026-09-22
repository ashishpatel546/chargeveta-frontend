import 'server-only';

import { cookies } from 'next/headers';
import { config } from '../config';

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
const ACCESS_COOKIE = 'cvd_at';
const REFRESH_COOKIE = 'cvd_rt';

export const DRIVER_SESSION_COOKIES = [ACCESS_COOKIE, REFRESH_COOKIE] as const;

export interface DriverTokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
}

export interface DriverSession {
  accessToken: string;
  refreshToken: string;
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/** Matches the API's driver refresh-token idle window (`charveta` doc 6 §22.3). */
const REFRESH_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

export async function readDriverSession(): Promise<DriverSession | null> {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function writeDriverSession(pair: DriverTokenPair): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, pair.accessToken, cookieOptions(pair.expiresInSeconds));
  jar.set(
    REFRESH_COOKIE,
    pair.refreshToken,
    cookieOptions(REFRESH_MAX_AGE_SECONDS),
  );
}

export async function clearDriverSession(): Promise<void> {
  const jar = await cookies();
  for (const name of DRIVER_SESSION_COOKIES) jar.delete(name);
}

/**
 * Exchanges a driver refresh token for a new pair.
 *
 * `/driver/auth/refresh` answers the same `TokenPairDto` shape `/auth/refresh`
 * does (no `created` flag — that only ever comes back from the sign-in routes
 * themselves), so this returns the same `DriverTokenPair` shape as every other
 * driver sign-in call by construction.
 */
export async function refreshDriverTokens(
  refreshToken: string,
): Promise<DriverTokenPair | null> {
  const response = await fetch(`${config.apiBaseUrl}/driver/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.json()) as DriverTokenPair;
}
