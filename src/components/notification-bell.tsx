'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BellIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRealtime } from '@/components/realtime-provider';
import { apiGet } from '@/lib/api/client';
import type { AppNotification, Page } from '@/lib/api/types';

/**
 * How many alerts are waiting, and whether the live feed is up.
 *
 * The count refetches on a timer as well as on a socket message, so it stays
 * roughly right on an installation with the socket turned off.
 */
export function NotificationBell() {
  const realtime = useRealtime();

  const { data } = useQuery({
    queryKey: ['notifications', 'unacknowledged', 'count'],
    queryFn: () =>
      apiGet<Page<AppNotification>>('/notifications', {
        unacknowledged: 'true',
        limit: '50',
      }),
    refetchInterval: realtime.connected ? false : 60_000,
  });

  const waiting = data?.items.length ?? 0;
  const label =
    waiting === 0
      ? 'No alerts waiting'
      : `${waiting} alert${waiting === 1 ? '' : 's'} waiting`;

  return (
    <>
      {realtime.available && !realtime.connected ? (
        <span
          className="text-muted-foreground hidden text-xs sm:inline"
          title="The console is not receiving live updates; it is refetching instead."
        >
          not live
        </span>
      ) : null}
      <Button
        render={<Link href="/notifications" className="relative" />}
        // What is rendered is a link, not a button, and Base UI wants telling:
        // without this it warns that the native button semantics are gone.
        nativeButton={false}
        variant="ghost"
        size="icon"
        aria-label={label}
      >
        <BellIcon className="size-5" />
        {waiting > 0 ? (
          <span className="bg-destructive absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-medium text-white">
            {waiting > 9 ? '9+' : waiting}
          </span>
        ) : null}
      </Button>
    </>
  );
}
