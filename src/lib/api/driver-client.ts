/**
 * The browser's side of the API, as a signed-in driver — `lib/api/client.ts`,
 * mirrored onto the driver proxy (`/api/cvd/...`) and its own session.
 */

export class DriverApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'DriverApiError';
  }
}

function url(path: string, params?: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== '') query.set(key, value);
  }
  const search = query.toString();
  return `/api/cvd${path}${search ? `?${search}` : ''}`;
}

async function refuse(response: Response): Promise<never> {
  if (response.status === 401 && typeof window !== 'undefined') {
    window.location.replace('/driver/sign-in?expired=1');
  }
  let message = `The API answered ${response.status}`;
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string') message = body.message;
    else if (Array.isArray(body.message)) message = body.message.join('; ');
  } catch {
    // Not JSON; the status will have to do.
  }
  throw new DriverApiError(response.status, message);
}

export async function driverApiGet<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const response = await fetch(url(path, params), {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) await refuse(response);
  return (await response.json()) as T;
}

export async function driverApiSend<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
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
