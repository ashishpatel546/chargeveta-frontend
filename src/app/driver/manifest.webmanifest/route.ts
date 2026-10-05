import { NextResponse } from 'next/server';
import { config } from '@/lib/config';

/**
 * The driver surface's own install manifest.
 *
 * Next's `manifest.ts` convention (`app/manifest.ts`, serving `/manifest.ts`)
 * only ever runs at the app root — there is no nested-segment equivalent, so
 * a second installable "app" under the same origin is a plain route handler
 * instead, linked from `driver/layout.tsx`'s `metadata.manifest`. `scope`
 * being `/driver` rather than `/` is what makes this a distinct installable
 * target from the operator console's own manifest at the true root: a
 * browser treats two manifests with different `scope`s as two "apps", each
 * installable on its own, even though both are served by this one Next app.
 */
export async function GET() {
  return NextResponse.json(
    {
      name: `${config.appName} driver`,
      short_name: config.appName,
      description: 'Find a charger, start and stop charging, and pay.',
      start_url: '/driver',
      scope: '/driver',
      display: 'standalone',
      orientation: 'any',
      background_color: '#f5f6fa',
      theme_color: '#1a2150',
      icons: [
        { src: '/icons/192', sizes: '192x192', type: 'image/png' },
        { src: '/icons/512', sizes: '512x512', type: 'image/png' },
        {
          src: '/icons/512',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    { headers: { 'content-type': 'application/manifest+json' } },
  );
}
