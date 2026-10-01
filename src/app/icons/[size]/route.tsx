import { ImageResponse } from 'next/og';

/**
 * The app icons, drawn rather than stored.
 *
 * A manifest needs at least a 192 and a 512 PNG for a browser to offer to
 * install the app, and Safari wants a 180 for the home screen. Generating them
 * keeps three binaries out of the repository and keeps them in step with each
 * other: there is one drawing, at three sizes — the bolt of `app/icon.svg`, the
 * favicon (with `favicon.ico` rendered from that SVG for older browsers).
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
          background: 'linear-gradient(180deg, #14b8a6, #0f766e)',
          borderRadius: size * 0.22,
        }}
      >
        {/* The same bolt as `app/icon.svg`, the favicon. */}
        <svg width={size} height={size} viewBox="0 0 64 64">
          <path
            d="M36 6 14 36h16l-4 22 24-32H34z"
            fill="#ffffff"
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
