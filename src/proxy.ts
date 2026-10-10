import { NextResponse, type NextRequest } from 'next/server';
import { clientHeadersFrom } from '@/lib/server/client-address';
import {
  DRIVER_SURFACE,
  FLEET_SURFACE,
  PLATFORM_SURFACE,
  requestRefresh,
  sessionCookies,
  STAFF_SURFACE,
  type SessionSurface,
} from '@/lib/server/session-surfaces';

/**
 * Runs before every page, and does two things.
 *
 * ## Keeps a signed-in session signed in
 *
 * The access cookie lasts as long as its fifteen-minute token; the refresh
 * cookie, as long as the session. A page requested after the first has gone
 * but while the second is still here — anyone who left a tab alone for a
 * quarter of an hour — is refreshed here, before it renders. It cannot be done
 * in the render: a Server Component cannot set a cookie, and a refresh whose
 * new token is not stored leaves the browser holding a spent one, which the API
 * treats as stolen (`apiFetch`'s `allowRefresh`). Here the new pair goes on the
 * response for the browser to keep, and onto the request for the render that
 * follows to use.
 *
 * Which pair depends on the page: `/driver`, `/fleet` and `/platform` each
 * carry their own (`lib/server/session-surfaces.ts`); everything else is the
 * staff console's.
 *
 * ## Sends a plainly signed-out visitor to the staff sign-in
 *
 * A shortcut, not the check. The real one is each surface's layout asking the
 * API who is signed in — a cookie being present says nothing about whether it
 * is still good, and only the API knows that. What this saves is rendering a
 * whole console page for someone with no session at all. The other surfaces'
 * layouts send their own visitors to their own sign-in pages.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const surface = surfaceFor(pathname);

  if (
    surface === STAFF_SURFACE &&
    !request.cookies.has(STAFF_SURFACE.refreshCookie)
  ) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }
  return refreshIfDue(request, surface);
}

function surfaceFor(pathname: string): SessionSurface {
  if (under(pathname, '/driver')) return DRIVER_SURFACE;
  // `/fleet` and not `/fleets` — the latter is the staff console's own page.
  if (under(pathname, '/fleet')) return FLEET_SURFACE;
  if (under(pathname, '/platform')) return PLATFORM_SURFACE;
  return STAFF_SURFACE;
}

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

async function refreshIfDue(
  request: NextRequest,
  surface: SessionSurface,
): Promise<NextResponse> {
  const refreshToken = request.cookies.get(surface.refreshCookie)?.value;
  if (!refreshToken || request.cookies.has(surface.accessCookie)) {
    return NextResponse.next();
  }

  const result = await requestRefresh(
    surface,
    refreshToken,
    clientHeadersFrom(request.headers),
  );

  if (result.kind === 'unavailable') {
    // Leave the cookies alone: the API is down, not the session. The page's
    // own call to the API will fail, and the next request tries again.
    return NextResponse.next();
  }

  if (result.kind === 'refused') {
    // The session is over. Drop the pair on both sides, so the layout sees
    // nobody signed in and sends them to sign in.
    request.cookies.delete(surface.accessCookie);
    request.cookies.delete(surface.refreshCookie);
    const response = forward(request);
    response.cookies.delete(surface.accessCookie);
    response.cookies.delete(surface.refreshCookie);
    return response;
  }

  const cookies = sessionCookies(surface, result.pair);
  for (const cookie of cookies) request.cookies.set(cookie.name, cookie.value);
  const response = forward(request);
  for (const cookie of cookies) response.cookies.set(cookie);
  return response;
}

/** Continues to the page with the request's cookies as they now stand. */
function forward(request: NextRequest): NextResponse {
  return NextResponse.next({ request: { headers: request.headers } });
}

export const config = {
  matcher: [
    /*
     * Pages only. Excluded: the API routes (which refresh for themselves, being
     * able to set cookies, and answer 401 when they cannot), Next's own assets,
     * the staff sign-in page and the setup page an invitation links to (whose
     * visitor by definition has no session yet), the offline page the service
     * worker shows, the favicons, and the files a browser fetches to install
     * the app (those are requested without cookies and must not redirect).
     * The other surfaces' public pages pass through: nothing here redirects
     * them, and with no cookie there is nothing to refresh.
     */
    '/((?!api|_next/static|_next/image|sign-in|setup|offline|icons|manifest.webmanifest|sw.js|favicon.ico|icon.svg).*)',
  ],
};
