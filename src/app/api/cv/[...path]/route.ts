import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/server/api';

/**
 * The console's only door to the API.
 *
 * Everything the browser asks for arrives here as `/api/cv/<api path>`, is
 * given the signed-in user's access token from the `httpOnly` cookie by
 * `apiFetch`, and is forwarded to the monolith. The browser never holds a
 * token, and nothing has to be relaxed on the API for a cross-origin caller —
 * which matters, because the API sends no CORS headers at all.
 */

/** Never proxied, whatever a page asks for. */
const FORBIDDEN_PREFIXES = [
  // The OCPP engine's private routes. They take a shared secret, not a user,
  // and one of them starts a charging session.
  'internal',
  // Platform administration takes `x-platform-secret`, which is deliberately
  // not something this console holds.
  'platform',
];

/** Response headers worth passing back; everything else is ours to set. */
const PASSED_THROUGH = ['content-type', 'content-disposition'];

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  if (FORBIDDEN_PREFIXES.includes(path[0] ?? '')) {
    return NextResponse.json(
      { message: 'That part of the API is not reachable from the console' },
      { status: 403 },
    );
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const call = await apiFetch(
    `/${path.join('/')}${request.nextUrl.search}`,
    {
      method: request.method,
      body: hasBody ? await request.text() : undefined,
      contentType: request.headers.get('content-type'),
      accept: request.headers.get('accept'),
    },
  );

  if (!call.ok) {
    return NextResponse.json(
      { message: 'The session has ended. Sign in again.' },
      { status: 401 },
    );
  }
  return relay(call.response);
}

async function relay(upstream: Response): Promise<Response> {
  // 204 and 304 must not carry a body, and constructing one with a body throws.
  if (upstream.status === 204 || upstream.status === 304) {
    return new NextResponse(null, { status: upstream.status });
  }
  const headers = new Headers();
  for (const name of PASSED_THROUGH) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers,
  });
}

type Context = RouteContext<'/api/cv/[...path]'>;

export async function GET(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
export async function PUT(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
