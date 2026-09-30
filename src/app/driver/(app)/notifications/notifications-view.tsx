'use client';

import { useEffect } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import Link from 'next/link';
import { Empty, Failed, Loading } from '@/components/driver-query-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { driverApiGet, driverApiSend } from '@/lib/api/driver-client';
import type { DriverNotificationPage } from '@/lib/api/driver-types';
import { dateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export const UNREAD_KEY = ['driver', 'notifications', 'unread'];

/**
 * What the driver was told, newest first (`charveta` doc 6 §22.3): every push
 * is kept here too, so one missed on the lock screen — or never delivered,
 * with no device allowed — can still be read. Opening the screen marks them
 * read; the ones that were unread keep their highlight until it is left.
 */
export function NotificationsView() {
  const queryClient = useQueryClient();
  const notifications = useInfiniteQuery({
    queryKey: ['driver', 'notifications'],
    queryFn: ({ pageParam }) =>
      driverApiGet<DriverNotificationPage>('/driver/notifications', {
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const markRead = useMutation({
    mutationFn: () => driverApiSend<void>('POST', '/driver/notifications/read'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: UNREAD_KEY }),
  });

  const unread = notifications.data?.pages[0]?.unread ?? 0;
  const { mutate } = markRead;
  useEffect(() => {
    if (unread > 0) mutate();
  }, [unread, mutate]);

  const rows = notifications.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader title="Notifications" />

      {notifications.isPending ? <Loading rows={4} /> : null}
      {notifications.isError ? <Failed error={notifications.error} /> : null}
      {notifications.isSuccess && rows.length === 0 ? (
        <Empty>
          Nothing yet. When a session starts or ends, a payment goes through or
          a refund arrives, it is kept here.
        </Empty>
      ) : null}

      <div className="space-y-3">
        {rows.map((item) => {
          const content = (
            <Card size="sm" className={cn(!item.readAt && 'border-primary/40')}>
              <CardContent className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{item.title}</p>
                  {!item.readAt ? (
                    <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
                  ) : null}
                </div>
                <p className="text-sm">{item.body}</p>
                <p className="text-muted-foreground text-xs">
                  {dateTime(item.createdAt)}
                </p>
              </CardContent>
            </Card>
          );
          return item.path?.startsWith('/driver') ? (
            <Link key={item.id} href={item.path} className="block">
              {content}
            </Link>
          ) : (
            <div key={item.id}>{content}</div>
          );
        })}
      </div>

      {notifications.hasNextPage ? (
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={() => void notifications.fetchNextPage()}
          disabled={notifications.isFetchingNextPage}
        >
          {notifications.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </>
  );
}
