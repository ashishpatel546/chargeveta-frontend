import { ImageResponse } from 'next/og';

/**
 * The app icons, drawn rather than stored.
 *
 * A manifest needs at least a 192 and a 512 PNG for a browser to offer to
 * install the app, and Safari wants a 180 for the home screen. Generating them
 * keeps three binaries out of the repository and keeps them in step with each
 * other: there is one drawing, at three sizes.
 */
const SIZES = [180, 192, 512];

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(
  _request: Request,
  ctx: RouteContext<'/icons/[size]'>,
) {
  const size = Number((await ctx.params).size);
  if (!SIZES.includes(size)) {
    return new Response('No icon that size', { status: 404 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f766e',
          color: '#ffffff',
          fontSize: size * 0.62,
          fontWeight: 700,
          borderRadius: size * 0.22,
        }}
      >
        ⚡
      </div>
    ),
    { width: size, height: size },
  );
}
