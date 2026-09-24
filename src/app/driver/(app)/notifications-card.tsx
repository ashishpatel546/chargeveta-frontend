'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { pushWorker } from '@/components/service-worker';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { driverApiGet, driverApiSend } from '@/lib/api/driver-client';
import type { DriverPushSubscriptionDto } from '@/lib/api/driver-types';

/**
 * Alerts on this device (doc 6 §22.4) — the driver counterpart to the
 * console's `PushDeviceCard`. Charging started, charging finished, a card
 * hold that failed, a wallet running low: things worth knowing about even
 * with the app closed. Everything here is about *this browser*.
 */
export function NotificationsCard() {
  const queryClient = useQueryClient();
  const support = useSyncExternalStore(noChange, detectSupport, () => null);
  const permission = useSyncExternalStore(
    noChange,
    () => (support === 'yes' ? Notification.permission : 'default'),
    () => 'default' as NotificationPermission,
  );
  const [endpoint, setEndpoint] = useState<string | null>(null);

  const key = useQuery({
    queryKey: ['driver', 'push-key'],
    queryFn: () =>
      driverApiGet<{ publicKey: string | null }>('/driver/push-subscriptions/key'),
  });
  const devices = useQuery({
    queryKey: ['driver', 'push-subscriptions'],
    queryFn: () =>
      driverApiGet<DriverPushSubscriptionDto[]>('/driver/push-subscriptions'),
  });

  useEffect(() => {
    if (support !== 'yes') return;
    void navigator.serviceWorker.getRegistration().then(async (registration) => {
      const current = await registration?.pushManager.getSubscription();
      setEndpoint(current?.endpoint ?? null);
    });
  }, [support]);

  const mine = devices.data?.find((row) => row.endpoint === endpoint) ?? null;
  const on = Boolean(endpoint && mine);

  const enable = useMutation({
    mutationFn: async () => {
      const publicKey = key.data?.publicKey;
      if (!publicKey) throw new Error('Push is not configured on this installation.');
      const granted = await Notification.requestPermission();
      if (granted !== 'granted') {
        throw new Error(
          granted === 'denied'
            ? 'This browser is blocking notifications. Allow them in the site settings, then try again.'
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
      await driverApiSend('POST', '/driver/push-subscriptions', {
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: describeBrowser(),
      });
      return subscription.endpoint;
    },
    onSuccess: (registered) => {
      setEndpoint(registered);
      void queryClient.invalidateQueries({ queryKey: ['driver', 'push-subscriptions'] });
      toast.success('Alerts are on for this device.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const disable = useMutation({
    mutationFn: async () => {
      if (mine) await driverApiSend('DELETE', `/driver/push-subscriptions/${mine.id}`);
      const registration = await navigator.serviceWorker.getRegistration();
      await (await registration?.pushManager.getSubscription())?.unsubscribe();
    },
    onSuccess: () => {
      setEndpoint(null);
      void queryClient.invalidateQueries({ queryKey: ['driver', 'push-subscriptions'] });
      toast.success('Alerts are off for this device.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Alerts on this device</CardTitle>
        <CardDescription>
          Charging starting and finishing, a payment that failed, or your
          wallet running low — sent here even when the app is closed.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {support === null || key.isPending ? (
          <p className="text-muted-foreground">Checking this browser…</p>
        ) : support !== 'yes' ? (
          <p className="text-muted-foreground">{UNSUPPORTED[support]}</p>
        ) : !key.data?.publicKey ? (
          <p className="text-muted-foreground">
            Push is not configured on this installation.
          </p>
        ) : permission === 'denied' ? (
          <p className="text-amber-700 dark:text-amber-500">
            This browser is blocking notifications. Allow them in the site
            settings (the icon beside the address), then reload.
          </p>
        ) : on ? (
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
        ) : (
          <Button
            size="sm"
            disabled={enable.isPending || devices.isPending}
            onClick={() => enable.mutate()}
          >
            {enable.isPending ? 'Turning on…' : 'Turn on for this device'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

type Support = 'yes' | 'no-worker' | 'no-push' | 'insecure';

const noChange = () => () => {};

const UNSUPPORTED: Record<Exclude<Support, 'yes'>, string> = {
  insecure:
    'Push needs a secure connection (https, or localhost while developing).',
  'no-worker': 'This browser cannot run the app in the background.',
  'no-push':
    'This browser does not support push. On an iPhone or iPad, add the app to your home screen first (Share, then Add to Home Screen) and open it from there.',
};

function detectSupport(): Support {
  if (!window.isSecureContext) return 'insecure';
  if (!('serviceWorker' in navigator)) return 'no-worker';
  if (!('PushManager' in window) || !('Notification' in window)) return 'no-push';
  return 'yes';
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const base64 = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

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
