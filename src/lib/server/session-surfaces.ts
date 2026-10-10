import { config } from '../config';

/**
 * The four signed-in surfaces' cookie pairs and refresh endpoints, in one
 * table, for the session files and `proxy.ts` alike.
 *
 * Deliberately not `server-only` and free of `next/headers`: `proxy.ts` runs
 * before a page renders, where neither applies, and it is the one place a page
 * request's session can be refreshed — a Server Component cannot set a cookie
 * (see `apiFetch`'s `allowRefresh`).
 */
export interface SessionSurface {
  accessCookie: string;
  refreshCookie: string;
  /** The API's refresh route, relative to `config.apiBaseUrl`. */
  refreshPath: string;
}

export const STAFF_SURFACE: SessionSurface = {
  accessCookie: 'cv_at',
  refreshCookie: 'cv_rt',
  refreshPath: '/auth/refresh',
};
export const DRIVER_SURFACE: SessionSurface = {
  accessCookie: 'cvd_at',
  refreshCookie: 'cvd_rt',
  refreshPath: '/driver/auth/refresh',
};
export const FLEET_SURFACE: SessionSurface = {
  accessCookie: 'cvf_at',
  refreshCookie: 'cvf_rt',
  refreshPath: '/fleet-manager/auth/refresh',
};
export const PLATFORM_SURFACE: SessionSurface = {
  accessCookie: 'cvp_at',
  refreshCookie: 'cvp_rt',
  refreshPath: '/platform/auth/refresh',
};

/** What every sign-in and refresh route answers. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  /** Of the access token. */
  expiresInSeconds: number;
  /**
   * Until the refresh token lapses unused, or the session reaches its maximum
   * age, whichever is sooner. Absent from an API that predates it.
   */
  refreshExpiresInSeconds?: number;
}

/**
 * A session as the cookies hold it. The access token is absent once its cookie
 * has expired, which says only that a refresh is due — the refresh cookie is
 * what decides whether anyone is signed in.
 */
export interface StoredSession {
  accessToken?: string;
  refreshToken: string;
}

/**
 * The access cookie is dropped this long before the token itself expires, so
 * that a page request arriving near the end refreshes in `proxy.ts` rather
 * than reaching a render with a token the API is about to refuse.
 */
const ACCESS_COOKIE_MARGIN_SECONDS = 60;

/** Used only when an older API sends no `refreshExpiresInSeconds`. */
const FALLBACK_REFRESH_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

export interface SessionCookie {
  name: string;
  value: string;
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: '/';
  maxAge: number;
}

/**
 * The two cookies a token pair is stored as.
 *
 * `secure` follows the deployment rather than being hard-coded: a secure cookie
 * is never sent over plain http, so hard-coding it on would break every local
 * run, and hard-coding it off would ship a token over the wire in production.
 */
export function sessionCookies(
  surface: SessionSurface,
  pair: TokenPair,
): [SessionCookie, SessionCookie] {
  const base = {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/' as const,
  };
  return [
    {
      ...base,
      name: surface.accessCookie,
      value: pair.accessToken,
      maxAge: Math.max(
        pair.expiresInSeconds - ACCESS_COOKIE_MARGIN_SECONDS,
        Math.ceil(pair.expiresInSeconds / 2),
      ),
    },
    {
      ...base,
      name: surface.refreshCookie,
      value: pair.refreshToken,
      maxAge:
        pair.refreshExpiresInSeconds ?? FALLBACK_REFRESH_MAX_AGE_SECONDS,
    },
  ];
}

export type RefreshResult =
  | { kind: 'issued'; pair: TokenPair }
  /** The API said no: the session is over, and the cookies should go. */
  | { kind: 'refused' }
  /**
   * The API could not be asked, or failed. Nothing is known about the session,
   * so the cookies stay — signing someone out because the API restarted would
   * be its own bug.
   */
  | { kind: 'unavailable' };

/**
 * Exchanges a refresh token for a new pair.
 *
 * The refresh token is single use: once this returns `issued`, the caller
 * must store the new pair, or the browser is left holding a replaced token
 * that the API will treat as stolen after its short grace window.
 */
export async function requestRefresh(
  surface: SessionSurface,
  refreshToken: string,
  clientHeaders: Record<string, string>,
): Promise<RefreshResult> {
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${surface.refreshPath}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...clientHeaders },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
  } catch {
    return { kind: 'unavailable' };
  }
  if (response.ok) {
    return { kind: 'issued', pair: (await response.json()) as TokenPair };
  }
  // 400 (malformed) and 401 (refused, revoked, expired) end the session;
  // anything else — a 5xx, a 429 — is the API's trouble, not the session's.
  if (response.status === 400 || response.status === 401) {
    return { kind: 'refused' };
  }
  return { kind: 'unavailable' };
}
