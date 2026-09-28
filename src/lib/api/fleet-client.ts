/**
 * The browser's side of the API, as a signed-in fleet manager —
 * `lib/api/client.ts`, mirrored onto the fleet proxy (`/api/cvf/...`).
 *
 * It throws the console's own `ApiError`, so the shared `Loading`/`Failed`
 * pieces in `components/query-state.tsx` read its refusals the same way.
 */
import { ApiError } from './client';

function url(path: string, params?: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== '') query.set(key, value);
  }
  const search = query.toString();
  return `/api/cvf${path}${search ? `?${search}` : ''}`;
}

async function refuse(response: Response): Promise<never> {
  if (response.status === 401 && typeof window !== 'undefined') {
    window.location.replace('/fleet/sign-in?expired=1');
  }
  let message = `The API answered ${response.status}`;
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string') message = body.message;
    else if (Array.isArray(body.message)) message = body.message.join('; ');
  } catch {
    // Not JSON; the status will have to do.
  }
  throw new ApiError(response.status, message);
}

export async function fleetApiGet<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const response = await fetch(url(path, params), {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) await refuse(response);
  return (await response.json()) as T;
}

export async function fleetApiSend<T>(
  method: 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(url(path), {
    method,
    headers: {
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) await refuse(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
