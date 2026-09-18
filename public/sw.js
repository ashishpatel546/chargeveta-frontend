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
 * It also shows web pushes (doc 6 §22.2): an alert raised while the console is
 * closed, or while this tab is in the background.
 */

// Bumped with the push handler: a new version string is what makes a browser
// install this file over the old one and drop the old caches with it.
const VERSION = 'v2';

// Registered as `/sw.js?mode=push-only` in development, when someone turns on
// alerts for this device (see `components/service-worker.tsx`). Push needs a
// worker; the asset cache is what makes a worker dangerous in development,
// where chunk names do not change when their contents do. So that mode shows
// pushes and leaves every request alone.
const PUSH_ONLY =
  new URL(self.location.href).searchParams.get('mode') === 'push-only';
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
  if (PUSH_ONLY) return;
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

/*
 * A push from the API's worker. The payload is what the `notification.raised`
 * and `test.message` templates render: `{title, body, path, tag}`.
 *
 * Every push must show a notification. Browsers require it
 * (`userVisibleOnly: true` is the only kind Chrome allows) and revoke the
 * permission of a site that receives pushes silently, so even a payload this
 * code cannot read is shown as something rather than dropped.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = typeof data.title === 'string' ? data.title : 'ChargeVeta';
  const options = {
    body: typeof data.body === 'string' ? data.body : '',
    icon: '/icons/192',
    badge: '/icons/192',
    // A path only, resolved against this worker's own origin — the console
    // that installed it — so a payload cannot send a click somewhere else.
    data: { path: safePath(data.path) },
  };
  if (typeof data.tag === 'string') {
    options.tag = data.tag;
    // The same tag again is the same alert updated; tell the person again
    // rather than changing the text under them silently.
    options.renotify = true;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

/*
 * A click goes to the console: to a tab that already has it open if there is
 * one, since the person is most likely to want the board they left, and to a
 * new one otherwise.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.path ?? '/notifications',
    self.location.origin,
  );

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if (new URL(client.url).origin === self.location.origin) {
            return client.focus().then((focused) => focused.navigate(target.href));
          }
        }
        return self.clients.openWindow(target.href);
      }),
  );
});

/** Only a same-origin path is accepted; anything else goes to the alerts. */
function safePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    return '/notifications';
  }
  return path;
}

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
