'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Empty, Failed, Loading } from '@/components/driver-query-state';
import { HistorySwitch } from './history-switch';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { driverApiGet } from '@/lib/api/driver-client';
import type {
  DriverSessionDto,
  DriverSessionPage,
} from '@/lib/api/driver-types';
import { dateTime, energy, money, span } from '@/lib/format';

/** Doc 6 §22.3 "Charging, sessions and receipts": the driver's own, newest first. */
export function SessionsView() {
  const sessions = useInfiniteQuery({
    queryKey: ['driver', 'sessions'],
    queryFn: ({ pageParam }) =>
      driverApiGet<DriverSessionPage>('/driver/sessions', {
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const rows = sessions.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader title="History" />
      <HistorySwitch />

      {sessions.isPending ? <Loading rows={3} /> : null}
      {sessions.isError ? <Failed error={sessions.error} /> : null}
      {sessions.isSuccess && rows.length === 0 ? (
        <Empty>
          No sessions yet. Start charging on a card of yours and it appears
          here.
        </Empty>
      ) : null}

      <div className="space-y-3">
        {rows.map((session) => (
          <SessionRow key={session.id} session={session} />
        ))}
      </div>

      {sessions.hasNextPage ? (
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={() => void sessions.fetchNextPage()}
          disabled={sessions.isFetchingNextPage}
        >
          {sessions.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </>
  );
}

function SessionCost({ session }: { session: DriverSessionDto }) {
  if (session.costStatus === 'unpriced') {
    return <span className="text-muted-foreground">not priced</span>;
  }
  if (session.costStatus === 'priced') {
    return <>{money(session.netMinor ?? undefined, session.currency ?? undefined)}</>;
  }
  return <span className="text-muted-foreground">—</span>;
}

function SessionRow({ session }: { session: DriverSessionDto }) {
  return (
    <Link href={`/driver/sessions/${session.id}`}>
      <Card size="sm">
        <CardContent className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {session.siteName ?? session.stationIdentity}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {dateTime(session.startedAt)} · {span(session.startedAt, session.stoppedAt ?? undefined)}
              {session.energyWh ? ` · ${energy(session.energyWh)}` : ''}
              {session.vehicle ? ` · ${session.vehicle.registration}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {!session.stoppedAt ? (
              <Badge
                variant="outline"
                className="border-live/50 bg-live/15 font-medium text-live-ink"
              >
                running
              </Badge>
            ) : (
              <span className="text-sm font-medium">
                <SessionCost session={session} />
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
