'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker that makes this installable.
 *
 * The worker itself is `public/sw.js`, written by hand rather than generated.
 * The usual generator for Next (Serwist) does not support Turbopack, which is
 * Next 16's default bundler, and what this console needs from a worker is
 * small: an offline page, cached static assets, and — from the driver phase
 * on — a `push` handler. A hand-written worker also means nothing about
 * caching is a surprise, which matters on a screen that shows whether a charger
 * is live.
 *
 * It registers only in production. A worker serving a cached shell during
 * development is a very effective way to spend an hour debugging a change that
 * did in fact save.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // An unregistered worker costs the offline shell, nothing else.
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
