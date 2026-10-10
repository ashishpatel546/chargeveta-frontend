import 'server-only';

import { config } from '../config';
import {
  clearPlatformSession,
  readPlatformSession,
  refreshPlatformTokens,
  writePlatformSession,
} from './platform-session';
import { clientHeaders } from './client-address';

/**
 * Calls the API as the signed-in platform administrator, refreshing once if
 * the access token has expired — `fleet-api.ts`, mirrored onto the platform
 * session pair. Platform pages rendering on the server and the `/api/cvp/*`
 * proxy both come through here, so the refresh rule is written once.
 */
export interface PlatformApiRequest {
  method?: string;
  body?: string;
  contentType?: string | null;
  accept?: string | null;
  /**
   * Whether this call may refresh the session. Off for a page rendering on the
   * server: a Server Component cannot set a cookie, so a refresh there would
   * spend the single-use refresh token without storing its replacement, and
   * the browser's next request would present the replaced one — which the API
   * treats as stolen and revokes the session. Pages are refreshed in
   * `proxy.ts` before they render instead. Defaults to on, for the Route
   * Handlers and Server Actions that can store what a refresh returns.
   */
  allowRefresh?: boolean;
}

export type PlatformApiCall =
  | { ok: true; response: Response }
  | { ok: false; expired: true };

export async function platformApiFetch(
  path: string,
  request: PlatformApiRequest = {},
): Promise<PlatformApiCall> {
  const session = await readPlatformSession();
  if (!session) return { ok: false, expired: true };
  const allowRefresh = request.allowRefresh ?? true;

  const url = `${config.apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  if (session.accessToken) {
    const response = await send(url, request, session.accessToken);
    if (response.status !== 401) return { ok: true, response };
  }
  if (!allowRefresh) return { ok: false, expired: true };

  const refreshed = await refreshPlatformTokens(session.refreshToken);
  if (refreshed.kind === 'refused') {
    await clearPlatformSession();
    return { ok: false, expired: true };
  }
  if (refreshed.kind === 'unavailable') {
    // The session may well be fine; only the API is not. Say so, rather than
    // signing the user out over an outage.
    return { ok: true, response: apiUnavailable() };
  }
  await writePlatformSession(refreshed.pair);
  return { ok: true, response: await send(url, request, refreshed.pair.accessToken) };
}

async function send(
  url: string,
  request: PlatformApiRequest,
  accessToken: string,
): Promise<Response> {
  // The browser's address and user agent, as far as we can vouch for them.
  const headers = new Headers(await clientHeaders());
  headers.set('authorization', `Bearer ${accessToken}`);
  if (request.contentType) headers.set('content-type', request.contentType);
  if (request.accept) headers.set('accept', request.accept);

  return fetch(url, {
    method: request.method ?? 'GET',
    headers,
    body: request.body === '' ? undefined : request.body,
    cache: 'no-store',
    redirect: 'manual',
  });
}

export class PlatformSessionExpiredError extends Error {
  constructor() {
    super('The session has ended');
    this.name = 'PlatformSessionExpiredError';
  }
}

export class PlatformApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The API's machine-readable reason, e.g. `PASSWORD_CHANGE_REQUIRED`. */
    readonly code?: string,
  ) {
    super(message);
    this.name = 'PlatformApiError';
  }
}

export async function platformApiGet<T>(path: string): Promise<T> {
  const call = await platformApiFetch(path, {
    accept: 'application/json',
    allowRefresh: false,
  });
  if (!call.ok) throw new PlatformSessionExpiredError();
  if (!call.response.ok) {
    const { message, code } = await readPlatformRefusal(call.response);
    throw new PlatformApiError(call.response.status, message, code);
  }
  return (await call.response.json()) as T;
}

/** The API's own words (and code, if any) for a refusal. */
export async function readPlatformRefusal(
  response: Response,
): Promise<{ message: string; code?: string }> {
  try {
    const body = (await response.json()) as { message?: unknown; code?: unknown };
    const code = typeof body.code === 'string' ? body.code : undefined;
    if (typeof body.message === 'string') return { message: body.message, code };
    if (Array.isArray(body.message)) {
      return { message: body.message.join('; '), code };
    }
    return { message: `The API answered ${response.status}`, code };
  } catch {
    // Not JSON. The status is all there is to report.
  }
  return { message: `The API answered ${response.status}` };
}

function apiUnavailable(): Response {
  return Response.json(
    { message: 'The service is unavailable. Try again shortly.' },
    { status: 503 },
  );
}
