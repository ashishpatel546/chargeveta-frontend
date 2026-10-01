import { NextResponse, type NextRequest } from 'next/server';

/**
 * Sends a visitor with no session to the sign-in page before a console page is
 * rendered at all.
 *
 * This is a shortcut, not the check. The real one is the layout asking the API
 * who is signed in — a cookie being present says nothing about whether it is
 * still good, and only the API knows that. What this saves is rendering a whole
 * page for someone who is plainly signed out.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has('cv_rt')) return NextResponse.next();
  // The fleet portal carries its own cookie pair (`cvf_at`/`cvf_rt`) and is
  // checked by `fleet/(app)/layout.tsx`'s `requireFleetManager()`, as
  // `/driver` is by its layout. Tested here rather than in the matcher
  // below, because the matcher's prefix test would also let staff's
  // `/fleets` pages through unchecked.
  const { pathname } = request.nextUrl;
  if (pathname === '/fleet' || pathname.startsWith('/fleet/')) {
    return NextResponse.next();
  }
  // The platform console likewise (`cvp_at`/`cvp_rt`, checked by
  // `platform/(app)/layout.tsx`'s `requirePlatformAdmin()`).
  if (pathname === '/platform' || pathname.startsWith('/platform/')) {
    return NextResponse.next();
  }

  const signIn = new URL('/sign-in', request.url);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: [
    /*
     * Everything except: the API routes (which answer 401 themselves), Next's
     * own assets, the sign-in page, the setup page an invitation links to
     * (whose visitor by definition has no session yet), the offline page the
     * service worker shows, the files a browser fetches to install the app
     * (those last are requested without cookies and must not redirect), and
     * the whole `/driver` tree — a driver carries a *different* cookie pair
     * (`cvd_at`/`cvd_rt`, `lib/server/driver-session.ts`), which this check
     * knows nothing about; `driver/(app)/layout.tsx`'s own `requireDriver()`
     * is the real check there, the same relationship this shortcut has to
     * `requirePrincipal()` for everything else.
     */
    '/((?!api|_next/static|_next/image|sign-in|setup|offline|icons|manifest.webmanifest|sw.js|favicon.ico|driver).*)',
  ],
};
