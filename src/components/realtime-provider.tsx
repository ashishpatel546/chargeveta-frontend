'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { config, realtimeEnabled } from '@/lib/config';

/**
 * Keeps the console's queries fresh from the API's socket.
 *
 * The socket's messages are thin on purpose — ids and what changed, never an
 * entity (doc 6 §21.1) — so this does not try to patch anything into the cache.
 * It marks the affected queries stale and lets React Query refetch through the
 * proxy, where the API's roles and tenancy still apply. That keeps the socket
 * from becoming a second source of truth, which is the reason it is thin.
 *
 * When there is no socket — the API ships with `REALTIME_ENABLED=false` — the
 * console still works; it just refetches on focus and on an interval instead.
 */

interface RealtimeState {
  /** Connected, or not: shown in the header so a stale board is never silent. */
  connected: boolean;
  /** False when this build was not given a realtime endpoint at all. */
  available: boolean;
}

const RealtimeContext = createContext<RealtimeState>({
  connected: false,
  available: false,
});

export function useRealtime(): RealtimeState {
  return useContext(RealtimeContext);
}

/** What the API sends. Only the ids are used here. */
interface StationMessage {
  stationId?: string;
  transactionRef?: string;
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!realtimeEnabled) return;

    let socket: Socket | undefined;
    let cancelled = false;

    const start = async () => {
      const token = await fetchToken('GET');
      if (!token || cancelled) return;

      socket = io(config.realtimeUrl, {
        path: config.realtimePath,
        // The API allows websockets only: long-polling would spread one client
        // over many requests and need sticky sessions across replicas.
        transports: ['websocket'],
        auth: { token },
      });

      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));
      socket.on('connect_error', () => setConnected(false));

      socket.on('session.ended', () => {
        // The credential stopped being valid. One refresh is worth a try; if
        // that fails the session really is over and the next API call will say
        // so.
        void (async () => {
          const fresh = await fetchToken('POST');
          if (!fresh || !socket) return;
          socket.emit('reauth', fresh, (result: { ok?: boolean } | boolean) => {
            const ok = typeof result === 'boolean' ? result : result?.ok;
            if (!ok) socket?.disconnect();
          });
        })();
      });

      const stations = (message: StationMessage) => {
        void queryClient.invalidateQueries({ queryKey: ['stations'] });
        if (message.stationId) {
          void queryClient.invalidateQueries({
            queryKey: ['station', message.stationId],
          });
        }
      };

      for (const event of [
        'station.connected',
        'station.disconnected',
        'station.booted',
        'station.report',
        'station.alert',
        'connector.status',
      ]) {
        socket.on(event, stations);
      }

      for (const event of ['session.event', 'session.meter']) {
        socket.on(event, (message: StationMessage) => {
          void queryClient.invalidateQueries({ queryKey: ['transactions'] });
          stations(message);
        });
      }

      socket.on('notification.created', () => {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        toast.info('A new alert arrived');
      });
    };

    void start();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [queryClient]);

  return (
    <RealtimeContext.Provider
      value={{ connected, available: realtimeEnabled }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

async function fetchToken(method: 'GET' | 'POST'): Promise<string | null> {
  try {
    const response = await fetch('/api/realtime-token', { method });
    if (!response.ok) return null;
    const body = (await response.json()) as { token?: string };
    return body.token ?? null;
  } catch {
    return null;
  }
}
