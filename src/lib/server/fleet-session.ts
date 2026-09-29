import 'server-only';

import { cookies } from 'next/headers';
import { config } from '../config';
import { clientHeaders } from './client-address';

/**
 * Where a fleet manager's tokens live — `driver-session.ts` again, in a third
 * cookie pair.
 *
 * A fleet manager is a third principal kind on the API (`charveta` doc 6 §23:
 * its own table, sessions, token audience and refresh endpoint), so it gets
 * cookies of its own. One browser can hold a staff, a driver and a fleet
 * session at once without any of them signing another out.
 */
const ACCESS_COOKIE = 'cvf_at';
const REFRESH_COOKIE = 'cvf_rt';

export const FLEET_SESSION_COOKIES = [ACCESS_COOKIE, REFRESH_COOKIE] as const;

export interface FleetTokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
}

export interface FleetSession {
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

/** The API gives fleet managers staff's session windows: fourteen days idle. */
const REFRESH_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

export async function readFleetSession(): Promise<FleetSession | null> {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function writeFleetSession(pair: FleetTokenPair): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, pair.accessToken, cookieOptions(pair.expiresInSeconds));
  jar.set(
    REFRESH_COOKIE,
    pair.refreshToken,
    cookieOptions(REFRESH_MAX_AGE_SECONDS),
  );
}

export async function clearFleetSession(): Promise<void> {
  const jar = await cookies();
  for (const name of FLEET_SESSION_COOKIES) jar.delete(name);
}

/** Exchanges a fleet manager refresh token for a new pair; null on refusal. */
export async function refreshFleetTokens(
  refreshToken: string,
): Promise<FleetTokenPair | null> {
  const response = await fetch(`${config.apiBaseUrl}/fleet-manager/auth/refresh`, {
    method: 'POST',
    headers: {
        'content-type': 'application/json',
        ...(await clientHeaders()),
      },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.json()) as FleetTokenPair;
}
