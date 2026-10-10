import { NextResponse } from 'next/server';
import {
  clearSession,
  readSession,
  refreshTokens,
  writeSession,
} from '@/lib/server/session';

/**
 * Hands the page an access token for the realtime socket, and only for that.
 *
 * The socket is the one thing the proxy cannot carry: it is a WebSocket
 * straight from the browser to the API, whose handshake wants the token in
 * `auth.token`. So this endpoint exists, and it is worth being clear about what
 * it costs. The access token becomes readable by code running on the page,
 * which is most of what `httpOnly` was protecting. What it does not hand over
 * is the refresh token: an access token is good for fifteen minutes, a refresh
 * token for a fortnight.
 *
 * The API must be started with `REALTIME_ENABLED=true` and this console's
 * origin in `REALTIME_CORS_ORIGINS` for the socket to be accepted.
 */
export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ message: 'Not signed in' }, { status: 401 });
  }
  // The access cookie lapses before the session does; a page left alone past
  // that still gets a socket, by refreshing first.
  if (!session.accessToken) return refreshAndHandOver(session.refreshToken);
  return NextResponse.json({ token: session.accessToken });
}

/**
 * Refreshes first, then hands over the new access token.
 *
 * A socket outlives an access token, and the API re-checks the credential on a
 * timer and ends the stream when it expires. The client calls this when it is
 * told the credential is no longer good, and sends the result back over the
 * socket's `reauth`.
 */
export async function POST() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ message: 'Not signed in' }, { status: 401 });
  }
  return refreshAndHandOver(session.refreshToken);
}

async function refreshAndHandOver(refreshToken: string): Promise<Response> {
  const refreshed = await refreshTokens(refreshToken);
  if (refreshed.kind === 'refused') {
    await clearSession();
    return NextResponse.json({ message: 'The session has ended' }, { status: 401 });
  }
  if (refreshed.kind === 'unavailable') {
    return NextResponse.json(
      { message: 'The service is unavailable. Try again shortly.' },
      { status: 503 },
    );
  }
  await writeSession(refreshed.pair);
  return NextResponse.json({ token: refreshed.pair.accessToken });
}
