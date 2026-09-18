'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { useCan } from '@/components/principal-context';
import { pushWorker } from '@/components/service-worker';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apiGet, apiSend } from '@/lib/api/client';
import type { PushSubscriptionRow } from '@/lib/api/types';

/**
 * Alerts on this device — web push (doc 6 §22.2).
 *
 * The console already shows alerts live while it is open. This is for when it
 * is not: a faulted connector or a quarantined charger reaches the phone in a
 * pocket. Warnings and critical alerts only; the API decides that, not this.
 *
 * Everything here is about *this browser*. A person with a laptop and a phone
 * turns it on in each, and turning it off here leaves the others alone.
 */
export function PushDeviceCard() {
  const canAdmin = useCan('admin');
  const queryClient = useQueryClient();
  // What the browser can do is only knowable in the browser. Read through
  // `useSyncExternalStore` so the server renders "checking" and the client
  // its real answer, without a mismatch and without a render-then-correct.
  const support = useSyncExternalStore(noChange, detectSupport, () => null);
  const permission = useSyncExternalStore(
    noChange,
    () => (support === 'yes' ? Notification.permission : 'default'),
    () => 'default' as NotificationPermission,
  );
  const [endpoint, setEndpoint] = useState<string | null>(null);

  const key = useQuery({
    queryKey: ['push-key'],
    queryFn: () => apiGet<{ publicKey: string | null }>('/push-subscriptions/key'),
  });
  const devices = useQuery({
    queryKey: ['push-subscriptions'],
    queryFn: () => apiGet<PushSubscriptionRow[]>('/push-subscriptions'),
  });

  // Whether this browser is already subscribed is an asynchronous question, so
  // it is asked once after mount and answered into state.
  useEffect(() => {
    if (support !== 'yes') return;
    void navigator.serviceWorker.getRegistration().then(async (registration) => {
      const current = await registration?.pushManager.getSubscription();
      setEndpoint(current?.endpoint ?? null);
    });
  }, [support]);

  const mine = devices.data?.find((row) => row.endpoint === endpoint) ?? null;
  const others = (devices.data ?? []).filter((row) => row.endpoint !== endpoint);
  const on = Boolean(endpoint && mine);

  const enable = useMutation({
    mutationFn: async () => {
      const publicKey = key.data?.publicKey;
      if (!publicKey) throw new Error('Push is not configured on this installation.');
      // The answer is read back through `permission` on the next render,
      // which this mutation's own state change causes.
      const granted = await Notification.requestPermission();
      if (granted !== 'granted') {
        throw new Error(
          granted === 'denied'
            ? 'This browser is blocking notifications from the console. Allow them in the site settings, then try again.'
            : 'Notifications were not allowed.',
        );
      }
      const registration = await pushWorker();
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: fromBase64Url(publicKey),
        }));
      const json = subscription.toJSON();
      await apiSend('POST', '/push-subscriptions', {
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: describeBrowser(),
      });
      return subscription.endpoint;
    },
    onSuccess: (registered) => {
      setEndpoint(registered);
      void queryClient.invalidateQueries({ queryKey: ['push-subscriptions'] });
      toast.success('Alerts are on for this device.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const disable = useMutation({
    mutationFn: async () => {
      // The server first: if the browser unsubscribes and the API call then
      // fails, the row is left pointing at an endpoint nothing listens on —
      // harmless, since the push service answers 410 and the worker deletes
      // it, but the other order leaves nothing to clean up at all.
      if (mine) await apiSend('DELETE', `/push-subscriptions/${mine.id}`);
      const registration = await navigator.serviceWorker.getRegistration();
      await (await registration?.pushManager.getSubscription())?.unsubscribe();
    },
    onSuccess: () => {
      setEndpoint(null);
      void queryClient.invalidateQueries({ queryKey: ['push-subscriptions'] });
      toast.success('Alerts are off for this device.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const test = useMutation({
    mutationFn: () =>
      apiSend<{ queued: number; note: string }>('POST', '/messages/test', {
        channel: 'push',
      }),
    onSuccess: (result) => toast.success(result.note),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card className="mb-4" size="sm">
      <CardHeader>
        <CardTitle>Alerts on this device</CardTitle>
        <CardDescription>
          A faulted connector or a quarantined charger, sent to this browser
          even when the console is closed. Warnings and critical alerts only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {support === null || key.isPending ? (
          <p className="text-muted-foreground">Checking this browser…</p>
        ) : support !== 'yes' ? (
          <p className="text-muted-foreground">{UNSUPPORTED[support]}</p>
        ) : !key.data?.publicKey ? (
          <p className="text-muted-foreground">
            This installation has no push keys configured, so alerts can only
            be seen in the console. An administrator sets{' '}
            <code className="font-mono text-xs">VAPID_PUBLIC_KEY</code> and its
            pair on the server.
          </p>
        ) : permission === 'denied' ? (
          <p className="text-amber-700 dark:text-amber-500">
            This browser is blocking notifications from the console. Allow them
            in the site settings (the icon beside the address), then reload.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {on ? (
              <>
                <span className="text-emerald-700 dark:text-emerald-500">
                  On for this device.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disable.isPending}
                  onClick={() => disable.mutate()}
                >
                  {disable.isPending ? 'Turning off…' : 'Turn off'}
                </Button>
                {canAdmin ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={test.isPending}
                    onClick={() => test.mutate()}
                  >
                    {test.isPending ? 'Sending…' : 'Send a test'}
                  </Button>
                ) : null}
              </>
            ) : (
              <Button
                size="sm"
                disabled={enable.isPending || devices.isPending}
                onClick={() => enable.mutate()}
              >
                {enable.isPending ? 'Turning on…' : 'Turn on for this device'}
              </Button>
            )}
          </div>
        )}
        {others.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            Also on for {others.length === 1 ? 'one other device' : `${others.length} other devices`}
            : {others.map((row) => row.userAgent ?? 'an unnamed browser').join(', ')}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

type Support = 'yes' | 'no-worker' | 'no-push' | 'insecure';

/**
 * Neither value this card reads from the browser announces its changes in a
 * way worth subscribing to here: support never changes, and permission
 * changes either through this card — which re-renders anyway — or in the
 * browser's settings, which the card's own copy tells the person to reload
 * after.
 */
const noChange = () => () => {};

const UNSUPPORTED: Record<Exclude<Support, 'yes'>, string> = {
  insecure:
    'Push needs a secure connection (https, or localhost while developing).',
  'no-worker': 'This browser cannot run the console in the background.',
  'no-push':
    'This browser does not support push. On an iPhone or iPad, add the console to the home screen first (Share, then Add to Home Screen) and open it from there.',
};

function detectSupport(): Support {
  if (!window.isSecureContext) return 'insecure';
  if (!('serviceWorker' in navigator)) return 'no-worker';
  if (!('PushManager' in window) || !('Notification' in window)) return 'no-push';
  return 'yes';
}

/** VAPID keys travel as base64url; `subscribe` wants the raw bytes. */
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const base64 = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Enough to tell "Chrome on Windows" from "Safari on iPhone" in the list of
 * devices, and nothing more. The raw user-agent string is long, changes with
 * every update and identifies the machine better than anyone needs.
 */
function describeBrowser(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const system = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'unknown system';
  return `${browser} on ${system}`;
}
