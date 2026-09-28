import 'server-only';

import { config } from '../config';
import {
  clearFleetSession,
  readFleetSession,
  refreshFleetTokens,
  writeFleetSession,
} from './fleet-session';

/**
 * Calls the API as the signed-in fleet manager, refreshing once if the access
 * token has expired — `driver-api.ts`, mirrored onto the fleet session pair.
 * A fleet page rendering on the server and the `/api/cvf/*` proxy both come
 * through here, so the refresh rule is written once.
 */
export interface FleetApiRequest {
  method?: string;
  body?: string;
  contentType?: string | null;
  accept?: string | null;
}

export type FleetApiCall =
  | { ok: true; response: Response }
  | { ok: false; expired: true };

export async function fleetApiFetch(
  path: string,
  request: FleetApiRequest = {},
): Promise<FleetApiCall> {
  const session = await readFleetSession();
  if (!session) return { ok: false, expired: true };

  const url = `${config.apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  let response = await send(url, request, session.accessToken);
  if (response.status !== 401) return { ok: true, response };

  const refreshed = await refreshFleetTokens(session.refreshToken);
  if (!refreshed) {
    await clearFleetSession();
    return { ok: false, expired: true };
  }
  await writeFleetSession(refreshed);
  response = await send(url, request, refreshed.accessToken);
  return { ok: true, response };
}

function send(
  url: string,
  request: FleetApiRequest,
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

export class FleetSessionExpiredError extends Error {
  constructor() {
    super('The session has ended');
    this.name = 'FleetSessionExpiredError';
  }
}

export class FleetApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'FleetApiError';
  }
}

export async function fleetApiGet<T>(path: string): Promise<T> {
  const call = await fleetApiFetch(path, { accept: 'application/json' });
  if (!call.ok) throw new FleetSessionExpiredError();
  if (!call.response.ok) {
    throw new FleetApiError(
      call.response.status,
      await readFleetMessage(call.response),
    );
  }
  return (await call.response.json()) as T;
}

/** The API's own words for a refusal, or a plain description of the status. */
export async function readFleetMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message)) return body.message.join('; ');
  } catch {
    // Not JSON. The status is all there is to report.
  }
  return `The API answered ${response.status}`;
}
