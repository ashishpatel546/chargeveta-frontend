import type { MetadataRoute } from 'next';
import { config } from '@/lib/config';

/**
 * What a browser needs to offer to install this.
 *
 * `start_url` is the stations board rather than `/`, because `/` only ever
 * redirects, and an installed app that starts on a redirect flashes an empty
 * screen every launch.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${config.appName} console`,
    short_name: config.appName,
    description: 'Operate charging stations, sessions, tariffs and receipts.',
    start_url: '/stations',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#0f766e',
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
  };
}
