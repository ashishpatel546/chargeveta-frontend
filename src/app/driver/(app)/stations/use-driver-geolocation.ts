'use client';

import { useCallback, useEffect, useState } from 'react';

interface Coords {
  latitude: number;
  longitude: number;
}

type Status = 'loading' | 'ready' | 'denied' | 'error';

/**
 * The browser's `navigator.geolocation`, wrapped as a hook for `StationsView`.
 * A real external system, so this is the one place on the driver screens
 * where an effect (not a render-time state adjustment) is the right tool —
 * unlike `OtpForm`'s wizard state, this genuinely syncs with something
 * outside React.
 *
 * State always starts `'loading'`, on the server and on the client's first
 * render alike — Next server-renders this client component once for the
 * initial HTML, and the server has no `navigator` at all, so anything that
 * branched on its presence at that point would print a different status than
 * the client's own first render and fail to hydrate (React error #418, hit
 * once while verifying this live). Whether geolocation exists is checked only
 * inside the effect, which never runs on the server.
 */
export function useDriverGeolocation(): {
  coords: Coords | null;
  status: Status;
  retry: () => void;
} {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      // Deferred a tick so this isn't a synchronous setState in the effect
      // body (react-hooks/set-state-in-effect) — in practice unreachable on
      // any browser this PWA targets, geolocation being a long-standard API.
      void Promise.resolve().then(() => setStatus('error'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setStatus('ready');
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }, [attempt]);

  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  return { coords, status, retry };
}
