import 'server-only';

import { config } from '../config';
import {
  clearSession,
  readSession,
  refreshTokens,
  writeSession,
} from './session';

/**
 * Calls the API as the signed-in user, refreshing once if the access token has
 * expired.
 *
 * Both callers go through here — the pages, which render on the server, and the
 * `/api/cv/*` proxy, which carries the browser's own requests — so the refresh
 * rule is written once. `expired` tells the caller the session is over and the
 * only thing left to do is sign in again.
 */
export interface ApiRequest {
  method?: string;
  body?: string;
  contentType?: string | null;
  accept?: string | null;
}

export type ApiCall =
  | { ok: true; response: Response }
  | { ok: false; expired: true };

export async function apiFetch(
  path: string,
  request: ApiRequest = {},
): Promise<ApiCall> {
  const session = await readSession();
  if (!session) return { ok: false, expired: true };

  const url = `${config.apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  let response = await send(url, request, session.accessToken);
  if (response.status !== 401) return { ok: true, response };

  const refreshed = await refreshTokens(session.refreshToken);
  if (!refreshed) {
    await clearSession();
    return { ok: false, expired: true };
  }
  await writeSession(refreshed);
  response = await send(url, request, refreshed.accessToken);
  return { ok: true, response };
}

function send(
  url: string,
  request: ApiRequest,
  accessToken: string,
): Promise<Response> {
  const headers = new Headers();
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

/** Raised when the API answered, but with a refusal. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Raised when there is no usable session left, so the caller must sign in. */
export class SessionExpiredError extends Error {
  constructor() {
    super('The session has ended');
    this.name = 'SessionExpiredError';
  }
}

/**
 * A GET that returns the parsed body, for server components.
 *
 * The API wraps nothing — a handler's payload is the body — so this is the
 * whole of it.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const call = await apiFetch(path, { accept: 'application/json' });
  if (!call.ok) throw new SessionExpiredError();
  if (!call.response.ok) {
    throw new ApiError(call.response.status, await readMessage(call.response));
  }
  return (await call.response.json()) as T;
}

/** The API's own words for a refusal, or a plain description of the status. */
export async function readMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message)) return body.message.join('; ');
  } catch {
    // Not JSON. The status is all there is to report.
  }
  return `The API answered ${response.status}`;
}
