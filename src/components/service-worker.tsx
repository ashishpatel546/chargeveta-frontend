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
/**
 * The worker that will receive pushes, registering one if need be.
 *
 * In production that is the worker `ServiceWorker` below already registered.
 * In development nothing registered one, so this registers the same file in
 * push-only mode, which leaves every request alone — see the comment at the
 * top of `public/sw.js`. Called only when somebody asks for alerts on this
 * device, so development without push behaves exactly as before.
 */
export async function pushWorker(): Promise<ServiceWorkerRegistration> {
  if (process.env.NODE_ENV !== 'production') {
    await navigator.serviceWorker.register('/sw.js?mode=push-only');
  }
  return navigator.serviceWorker.ready;
}

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
