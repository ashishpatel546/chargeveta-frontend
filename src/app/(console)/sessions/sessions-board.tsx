'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet } from '@/lib/api/client';
import type { Station, Transaction } from '@/lib/api/types';
import { dateTime, energy, money, span } from '@/lib/format';

/**
 * What the list is narrowed by, in the shape the API takes it: `open` and
 * `costFlagged` are the literal string "true", and a filter that is off is left
 * out of the query string entirely rather than sent as "false".
 */
type SessionFilters = Record<string, string | undefined>;

const ALL_STATIONS = 'all';

export function SessionsBoard() {
  const [stationId, setStationId] = useState(ALL_STATIONS);
  const [openOnly, setOpenOnly] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const filters = useMemo<SessionFilters>(
    () => ({
      ...(stationId === ALL_STATIONS ? {} : { stationId }),
      ...(openOnly ? { open: 'true' as const } : {}),
      ...(flaggedOnly ? { costFlagged: 'true' as const } : {}),
    }),
    [stationId, openOnly, flaggedOnly],
  );

  // The realtime provider marks `['transactions']` stale on every session
  // event, so a running session updates here without this screen polling.
  const sessions = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => apiGet<Transaction[]>('/transactions', filters),
  });

  // A session carries its charger as an id. The names are fetched once and
  // joined here rather than asking for each row's station.
  const stations = useQuery({
    queryKey: ['stations'],
    queryFn: () => apiGet<Station[]>('/stations'),
  });

  const identities = useMemo(() => {
    const names = new Map<string, string>();
    for (const station of stations.data ?? []) names.set(station.id, station.identity);
    return names;
  }, [stations.data]);

  const rows = sessions.data ?? [];

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Charging sessions, newest first. The API sends the most recent 200."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={stationId}
          onValueChange={(value) => setStationId(value ?? ALL_STATIONS)}
        >
          <SelectTrigger aria-label="Charger" className="min-w-48">
            <SelectValue placeholder="Every charger" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATIONS}>Every charger</SelectItem>
            {(stations.data ?? []).map((station) => (
              <SelectItem key={station.id} value={station.id}>
                {station.identity}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={openOnly ? 'default' : 'outline'}
          aria-pressed={openOnly}
          onClick={() => setOpenOnly((on) => !on)}
        >
          Running now
        </Button>
        <Button
          variant={flaggedOnly ? 'default' : 'outline'}
          aria-pressed={flaggedOnly}
          onClick={() => setFlaggedOnly((on) => !on)}
        >
          Needs a look
        </Button>
        <p className="text-muted-foreground text-xs">
          Needs a look: the price was flagged for review.
        </p>
      </div>

      {sessions.isPending ? <Loading /> : null}
      {sessions.isError ? <Failed error={sessions.error} /> : null}
      {sessions.isSuccess && rows.length === 0 ? (
        <Empty>
          {stationId === ALL_STATIONS && !openOnly && !flaggedOnly
            ? 'No sessions yet. One appears here as soon as a charger starts charging.'
            : 'No session matches those filters.'}
        </Empty>
      ) : null}

      {sessions.isSuccess && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Charger</TableHead>
                <TableHead>Card</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Energy</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <Link
                      href={`/sessions/${session.id}`}
                      className="font-medium hover:underline"
                    >
                      {session.transactionRef}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      OCPP {session.protocolVersion}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link
                      href={`/stations/${session.stationId}`}
                      className="hover:underline"
                    >
                      {identities.get(session.stationId) ?? 'Unknown charger'}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {session.idToken ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {dateTime(session.startedAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {span(session.startedAt, session.stoppedAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {energy(session.energyWh)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <SessionCost session={session} />
                  </TableCell>
                  <TableCell>
                    {session.isOpen ? (
                      <Badge
                        variant="outline"
                        className="border-sky-600/30 bg-sky-600/10 font-medium text-sky-700 dark:text-sky-400"
                      >
                        running
                      </Badge>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </>
  );
}

/**
 * A session's cost as one cell.
 *
 * "Unpriced" is not a missing value: it is the platform saying it knows what
 * happened and cannot put a price on it, with a reason. A session with no cost
 * at all has simply not been priced yet, which is a different thing and reads
 * as an em dash.
 */
function SessionCost({ session }: { session: Transaction }) {
  const cost = session.cost;
  if (!cost) return <>—</>;
  if (cost.status === 'unpriced') {
    return (
      <span className="text-muted-foreground" title={cost.unpricedReason}>
        not priced
      </span>
    );
  }
  return <>{money(cost.totalMinor, cost.currency)}</>;
}
