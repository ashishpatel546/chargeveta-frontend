'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { FleetSessionPage } from '@/lib/api/fleet-types';
import { dateTime, energy, money } from '@/lib/format';
import { SessionBillingBadge } from './billing-badge';

/**
 * A fleet's members' sessions, newest first — only those begun after each
 * member joined the fleet; the API never returns earlier ones.
 *
 * The vehicle is the one recorded when the session started (the driver's one
 * assigned vehicle then), not whoever has the car now; a dash means none was
 * recorded — no vehicle or several assigned, or a session from before
 * vehicles were recorded.
 */
export function FleetSessionsTable({
  queryKey,
  fetchPage,
}: {
  queryKey: readonly unknown[];
  fetchPage: (cursor: string | undefined) => Promise<FleetSessionPage>;
}) {
  const sessions = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = sessions.data?.pages.flatMap((page) => page.items) ?? [];

  if (sessions.isPending) return <Loading />;
  if (sessions.isError) return <Failed error={sessions.error} />;
  if (rows.length === 0) {
    return (
      <Empty>
        No sessions yet. A driver&apos;s sessions appear here from the day they
        join the fleet.
      </Empty>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Where</TableHead>
              <TableHead className="text-right">Energy</TableHead>
              <TableHead className="text-right">Charged</TableHead>
              <TableHead>Billed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="text-sm">
                  {dateTime(session.startedAt)}
                  {!session.stoppedAt ? (
                    <span className="ml-2 text-xs text-sky-700 dark:text-sky-400">
                      running
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm">
                  {session.driverName ?? '—'}
                </TableCell>
                <TableCell className="text-sm">
                  {session.vehicle ? (
                    <span title={session.vehicle.label ?? undefined}>
                      {session.vehicle.registration}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {session.siteName ?? session.stationIdentity}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {session.energyWh ? energy(session.energyWh) : '—'}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {session.chargedMinor
                    ? money(session.chargedMinor, session.currency ?? undefined)
                    : session.totalMinor
                      ? money(session.totalMinor, session.currency ?? undefined)
                      : '—'}
                </TableCell>
                <TableCell>
                  <SessionBillingBadge session={session} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {sessions.hasNextPage ? (
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => void sessions.fetchNextPage()}
          disabled={sessions.isFetchingNextPage}
        >
          {sessions.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </>
  );
}
