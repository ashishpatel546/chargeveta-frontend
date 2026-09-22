import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { driverApiFetch } from '@/lib/server/driver-api';

/**
 * The driver surface's only door to the API — `api/cv/[...path]/route.ts`,
 * mirrored onto the driver session pair rather than the staff one.
 *
 * A second proxy rather than a flag on the first: the two carry different
 * cookies and refresh against different endpoints (`driver-api.ts` vs
 * `lib/server/api.ts`), and a single proxy branching on which session to read
 * would have to infer that from the path alone, which is exactly the kind of
 * "is this a driver route" guess `FORBIDDEN_PREFIXES` below shows the cost of
 * getting wrong.
 */

/** Never proxied, whatever a page asks for — same reasoning as the staff proxy. */
const FORBIDDEN_PREFIXES = ['internal', 'platform'];

const PASSED_THROUGH = ['content-type', 'content-disposition'];

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  if (FORBIDDEN_PREFIXES.includes(path[0] ?? '')) {
    return NextResponse.json(
      { message: 'That part of the API is not reachable from here' },
      { status: 403 },
    );
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const call = await driverApiFetch(
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

type Context = RouteContext<'/api/cvd/[...path]'>;

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
