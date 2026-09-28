import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { fleetApiFetch } from '@/lib/server/fleet-api';

/**
 * The fleet portal's only door to the API — `api/cvd/[...path]/route.ts`,
 * mirrored onto the fleet manager's session pair.
 *
 * Narrower than the other two proxies: an allow-list of one prefix rather
 * than a deny-list. Everything a fleet manager can do is under
 * `/fleet-manager`, and the API refuses a fleet token anywhere else anyway;
 * this just means the portal cannot even ask. Signing in, setting up and
 * signing out are server actions (`lib/server/fleet-auth.ts`), not this.
 */
const ALLOWED_PREFIX = 'fleet-manager';

const PASSED_THROUGH = ['content-type', 'content-disposition'];

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  if (path[0] !== ALLOWED_PREFIX || path[1] === 'auth') {
    return NextResponse.json(
      { message: 'That part of the API is not reachable from here' },
      { status: 403 },
    );
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const call = await fleetApiFetch(
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

type Context = RouteContext<'/api/cvf/[...path]'>;

export async function GET(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
