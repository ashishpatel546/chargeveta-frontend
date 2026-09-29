import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { platformApiFetch } from '@/lib/server/platform-api';

/**
 * The platform console's only door to the API — `api/cvf/[...path]/route.ts`,
 * mirrored onto the platform administrator's session pair.
 *
 * Everything the browser asks for arrives as `/api/cvp/<path>` and is
 * forwarded to the API's `/platform/<path>`, so the platform console can
 * reach nothing outside `/platform` even by accident. `auth` is refused
 * here: signing in, changing the password and signing out are server actions
 * (`lib/server/platform-auth.ts`), which set and clear the cookies themselves.
 */
const PASSED_THROUGH = ['content-type', 'content-disposition'];

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  if (path.length === 0 || path[0] === 'auth') {
    return NextResponse.json(
      { message: 'That part of the API is not reachable from here' },
      { status: 403 },
    );
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const call = await platformApiFetch(
    `/platform/${path.join('/')}${request.nextUrl.search}`,
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

type Context = RouteContext<'/api/cvp/[...path]'>;

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
