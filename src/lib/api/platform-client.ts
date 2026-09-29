/**
 * The browser's side of the API, as a signed-in platform administrator —
 * `lib/api/client.ts`, mirrored onto the platform proxy (`/api/cvp/...`).
 * Paths are relative to the API's `/platform`: `platformApiGet('/tenants')`
 * reaches `/api/v1/platform/tenants`.
 *
 * It throws the console's own `ApiError`, so the shared `Loading`/`Failed`
 * pieces in `components/query-state.tsx` read its refusals the same way.
 */
import { ApiError, PASSWORD_CHANGE_REQUIRED, readRefusal } from './client';

function url(path: string): string {
  return `/api/cvp${path}`;
}

async function refuse(response: Response): Promise<never> {
  if (response.status === 401 && typeof window !== 'undefined') {
    window.location.replace('/platform/sign-in?expired=1');
  }
  const { message, code } = await readRefusal(response);
  if (
    response.status === 403 &&
    code === PASSWORD_CHANGE_REQUIRED &&
    typeof window !== 'undefined'
  ) {
    // The one place the platform screens are sent to change a temporary
    // password mid-session; `requirePlatformAdmin()` does it on page load.
    window.location.replace('/platform/change-password');
  }
  throw new ApiError(response.status, message, code);
}

export async function platformApiGet<T>(path: string): Promise<T> {
  const response = await fetch(url(path), {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) await refuse(response);
  return (await response.json()) as T;
}

export async function platformApiSend<T>(
  method: 'POST' | 'PUT' | 'PATCH',
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
