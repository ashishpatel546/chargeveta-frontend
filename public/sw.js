/*
 * The console's service worker.
 *
 * Deliberately small, and deliberately not a caching layer over the API. This
 * screen tells an operator whether a charger is live; serving a cached answer
 * to that question is worse than showing nothing. So:
 *
 *   - API calls (/api/*) are never cached and never served from a cache;
 *   - built assets (/_next/static/*) are cached forever, because their names
 *     contain a hash, so a new build asks for new names;
 *   - a navigation that cannot reach the network falls back to /offline, which
 *     says so plainly rather than showing a stale board.
 *
 * A `push` handler will arrive with the driver phase, where the VAPID keys and
 * the subscription endpoints are built.
 */

const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== SHELL && name !== ASSETS)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Anything that talks to the API, including the sign-in actions, goes to the
  // network or fails. Never a cache.
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached ?? Response.error();
      }),
    );
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSETS);
    cache.put(request, response.clone());
  }
  return response;
}
