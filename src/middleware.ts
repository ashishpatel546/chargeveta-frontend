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
export function middleware(request: NextRequest) {
  if (request.cookies.has('cv_rt')) return NextResponse.next();

  const signIn = new URL('/sign-in', request.url);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: [
    /*
     * Everything except: the API routes (which answer 401 themselves), Next's
     * own assets, the sign-in page, the setup page an invitation links to
     * (whose visitor by definition has no session yet), the offline page the
     * service worker shows, and the files a browser fetches to install the
     * app — those last are requested without cookies and must not redirect.
     */
    '/((?!api|_next/static|_next/image|sign-in|setup|offline|icons|manifest.webmanifest|sw.js|favicon.ico).*)',
  ],
};
