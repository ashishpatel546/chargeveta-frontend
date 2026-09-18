'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet, apiSend } from '@/lib/api/client';
import type {
  AppNotification,
  NotificationKind,
  Page,
  Station,
} from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const SEVERITY_TONE: Record<AppNotification['severity'], string> = {
  info: 'border-sky-600/30 bg-sky-600/10 text-sky-700 dark:text-sky-400',
  warning:
    'border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-500',
  critical: 'border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400',
};

const KIND_LABEL: Record<NotificationKind, string> = {
  'connector.faulted': 'Connector faulted',
  'station.quarantined': 'Charger quarantined',
  'station.offline': 'Charger offline',
  'security.event': 'Security event',
};

export function NotificationsBoard() {
  const [waitingOnly, setWaitingOnly] = useState(true);
  const canAcknowledge = useCan('operator');
  const queryClient = useQueryClient();

  // The key starts with 'notifications' so acknowledging refreshes the header's
  // bell, which counts what is waiting under the same prefix.
  const alerts = useInfiniteQuery({
    queryKey: ['notifications', 'list', waitingOnly],
    queryFn: ({ pageParam }) =>
      apiGet<Page<AppNotification>>('/notifications', {
        unacknowledged: waitingOnly ? 'true' : undefined,
        limit: '50',
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  // An alert names a charger by id only, so the names are fetched once and
  // joined here rather than one request per row.
  const stations = useQuery({
    queryKey: ['stations'],
    queryFn: () => apiGet<Station[]>('/stations'),
  });

  const stationNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const station of stations.data ?? []) names.set(station.id, station.identity);
    return names;
  }, [stations.data]);

  const rows = useMemo(
    () => (alerts.data?.pages ?? []).flatMap((page) => page.items),
    [alerts.data],
  );

  const acknowledge = useMutation({
    mutationFn: (id: string) =>
      apiSend<AppNotification>('POST', `/notifications/${id}/acknowledge`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        title="Alerts"
        description="What the system noticed on its own: faults, quarantines, chargers that went quiet, and security events."
      />

      <div className="mb-4 flex gap-2">
        <Button
          variant={waitingOnly ? 'default' : 'outline'}
          size="sm"
          aria-pressed={waitingOnly}
          onClick={() => setWaitingOnly(true)}
        >
          Waiting
        </Button>
        <Button
          variant={waitingOnly ? 'outline' : 'default'}
          size="sm"
          aria-pressed={!waitingOnly}
          onClick={() => setWaitingOnly(false)}
        >
          Everything
        </Button>
      </div>

      {alerts.isPending ? <Loading /> : null}
      {alerts.isError ? <Failed error={alerts.error} /> : null}
      {alerts.isSuccess && rows.length === 0 ? (
        <Empty>
          {waitingOnly
            ? 'Nothing is waiting to be acknowledged.'
            : 'No alerts have been raised.'}
        </Empty>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>What happened</TableHead>
                <TableHead>Charger</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead>Acknowledged</TableHead>
                {canAcknowledge ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('font-medium', SEVERITY_TONE[alert.severity])}
                    >
                      {alert.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal">
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {KIND_LABEL[alert.kind] ?? alert.kind}
                    </p>
                    <NotificationDetail detail={alert.detail} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {alert.stationId ? (
                      <Link
                        href={`/stations/${alert.stationId}`}
                        className="hover:underline"
                      >
                        {stationNames.get(alert.stationId) ?? 'Charger'}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {dateTime(alert.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {alert.acknowledgedAt ? (
                      <>
                        <span className="text-foreground">
                          {alert.acknowledgedBy ?? 'someone'}
                        </span>
                        <p className="text-xs">{dateTime(alert.acknowledgedAt)}</p>
                      </>
                    ) : (
                      'waiting'
                    )}
                  </TableCell>
                  {canAcknowledge ? (
                    <TableCell>
                      {alert.acknowledgedAt ? null : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            acknowledge.isPending &&
                            acknowledge.variables === alert.id
                          }
                          onClick={() => acknowledge.mutate(alert.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {alerts.hasNextPage ? (
        <Button
          variant="outline"
          className="mt-4"
          disabled={alerts.isFetchingNextPage}
          onClick={() => void alerts.fetchNextPage()}
        >
          {alerts.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </>
  );
}

/**
 * Whatever the alert carried with it.
 *
 * The shape differs per kind and the API does not promise one, so it is shown
 * as the JSON it is rather than guessed at field by field.
 */
function NotificationDetail({ detail }: { detail: Record<string, unknown> }) {
  if (!detail || Object.keys(detail).length === 0) return null;
  return (
    <details className="mt-1">
      <summary className="text-muted-foreground cursor-pointer text-xs select-none">
        Detail
      </summary>
      <pre className="bg-muted mt-1 overflow-x-auto rounded p-2 font-mono text-xs">
        {JSON.stringify(detail, null, 2)}
      </pre>
    </details>
  );
}
