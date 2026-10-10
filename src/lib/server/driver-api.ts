import 'server-only';

import { config } from '../config';
import {
  clearDriverSession,
  readDriverSession,
  refreshDriverTokens,
  writeDriverSession,
} from './driver-session';
import { clientHeaders } from './client-address';

/**
 * Calls the API as the signed-in driver, refreshing once if the access token
 * has expired — `lib/server/api.ts`'s `apiFetch`, mirrored for the driver
 * session pair. Both a driver page rendering on the server and the
 * `/api/cvd/*` proxy carrying the browser's own requests go through here, so
 * the refresh rule is written once.
 */
export interface DriverApiRequest {
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

export type DriverApiCall =
  | { ok: true; response: Response }
  | { ok: false; expired: true };

export async function driverApiFetch(
  path: string,
  request: DriverApiRequest = {},
): Promise<DriverApiCall> {
  const session = await readDriverSession();
  if (!session) return { ok: false, expired: true };
  const allowRefresh = request.allowRefresh ?? true;

  const url = `${config.apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  if (session.accessToken) {
    const response = await send(url, request, session.accessToken);
    if (response.status !== 401) return { ok: true, response };
  }
  if (!allowRefresh) return { ok: false, expired: true };

  const refreshed = await refreshDriverTokens(session.refreshToken);
  if (refreshed.kind === 'refused') {
    await clearDriverSession();
    return { ok: false, expired: true };
  }
  if (refreshed.kind === 'unavailable') {
    // The session may well be fine; only the API is not. Say so, rather than
    // signing the user out over an outage.
    return { ok: true, response: apiUnavailable() };
  }
  await writeDriverSession(refreshed.pair);
  return { ok: true, response: await send(url, request, refreshed.pair.accessToken) };
}

async function send(
  url: string,
  request: DriverApiRequest,
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

export class DriverApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'DriverApiError';
  }
}

export class DriverSessionExpiredError extends Error {
  constructor() {
    super('The session has ended');
    this.name = 'DriverSessionExpiredError';
  }
}

export async function driverApiGet<T>(path: string): Promise<T> {
  const call = await driverApiFetch(path, {
    accept: 'application/json',
    allowRefresh: false,
  });
  if (!call.ok) throw new DriverSessionExpiredError();
  if (!call.response.ok) {
    throw new DriverApiError(
      call.response.status,
      await readDriverMessage(call.response),
    );
  }
  return (await call.response.json()) as T;
}

/** The API's own words for a refusal, or a plain description of the status. */
export async function readDriverMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message)) return body.message.join('; ');
  } catch {
    // Not JSON. The status is all there is to report.
  }
  return `The API answered ${response.status}`;
}

function apiUnavailable(): Response {
  return Response.json(
    { message: 'The service is unavailable. Try again shortly.' },
    { status: 503 },
  );
}
