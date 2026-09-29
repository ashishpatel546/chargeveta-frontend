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
    /** The API's machine-readable reason, when it gives one. */
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The `code` the API puts on a 403 while the signed-in person still has to
 * change a temporary password. Staff and platform admins both get it; every
 * route but "who am I", "change password" and "sign out" answers with it.
 */
export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

/**
 * Reads a refusal's body once: its message (or a plain description of the
 * status) and its `code`, if any. Shared by the console, fleet and platform
 * clients so they read the API's refusals the same way.
 */
export async function readRefusal(
  response: Response,
): Promise<{ message: string; code?: string }> {
  let message = `The API answered ${response.status}`;
  let code: string | undefined;
  try {
    const body = (await response.json()) as { message?: unknown; code?: unknown };
    if (typeof body.message === 'string') message = body.message;
    else if (Array.isArray(body.message)) message = body.message.join('; ');
    if (typeof body.code === 'string') code = body.code;
  } catch {
    // Not JSON; the status will have to do.
  }
  return { message, code };
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
  const { message, code } = await readRefusal(response);
  if (
    response.status === 403 &&
    code === PASSWORD_CHANGE_REQUIRED &&
    typeof window !== 'undefined'
  ) {
    // Written here, once, so no screen has to: whatever a page was asking
    // for, the API will refuse it until the password is changed, so there is
    // nowhere to go but the change-password page. The console layout makes
    // the same check up front; this catches a flag set mid-session (an owner
    // resetting it while this tab was open).
    window.location.replace('/change-password');
  }
  throw new ApiError(response.status, message, code);
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
