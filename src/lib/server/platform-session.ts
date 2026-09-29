import 'server-only';

import { cookies } from 'next/headers';
import { config } from '../config';
import { clientHeaders } from './client-address';

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
const ACCESS_COOKIE = 'cvp_at';
const REFRESH_COOKIE = 'cvp_rt';

export const PLATFORM_SESSION_COOKIES = [ACCESS_COOKIE, REFRESH_COOKIE] as const;

export interface PlatformTokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
}

export interface PlatformSession {
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

/**
 * How long the refresh cookie is kept. The API decides how long the refresh
 * token itself is good for; a cookie that outlives it only means the next
 * refresh is refused and the admin signs in again.
 */
const REFRESH_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

export async function readPlatformSession(): Promise<PlatformSession | null> {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function writePlatformSession(pair: PlatformTokenPair): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, pair.accessToken, cookieOptions(pair.expiresInSeconds));
  jar.set(
    REFRESH_COOKIE,
    pair.refreshToken,
    cookieOptions(REFRESH_MAX_AGE_SECONDS),
  );
}

export async function clearPlatformSession(): Promise<void> {
  const jar = await cookies();
  for (const name of PLATFORM_SESSION_COOKIES) jar.delete(name);
}

/** Exchanges a platform refresh token for a new pair; null on refusal. */
export async function refreshPlatformTokens(
  refreshToken: string,
): Promise<PlatformTokenPair | null> {
  const response = await fetch(`${config.apiBaseUrl}/platform/auth/refresh`, {
    method: 'POST',
    headers: {
        'content-type': 'application/json',
        ...(await clientHeaders()),
      },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.json()) as PlatformTokenPair;
}
