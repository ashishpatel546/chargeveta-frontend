/**
 * The browser's side of the API.
 *
 * Every call goes to this app's own `/api/cv/...`, which attaches the token and
 * forwards it. Nothing here knows what a token looks like, which is the point.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function url(path: string, params?: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== '') query.set(key, value);
  }
  const search = query.toString();
  return `/api/cv${path}${search ? `?${search}` : ''}`;
}

async function refuse(response: Response): Promise<never> {
  if (response.status === 401 && typeof window !== 'undefined') {
    // The proxy has already tried refreshing and given up, so the session is
    // over. A full page load rather than a router navigation, on purpose: it
    // throws away every cached answer the signed-out session collected, which
    // a client-side navigation would keep.
    window.location.replace('/sign-in?expired=1');
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

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const response = await fetch(url(path, params), {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) await refuse(response);
  return (await response.json()) as T;
}

/**
 * A write. `undefined` comes back for the routes that answer 204, which is
 * most of the deletes.
 */
export async function apiSend<T>(
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
