'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { DownloadIcon, SearchIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Pager,
  SortableHead,
  useDebounced,
  useUrlState,
  type SortState,
} from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { NumberedPage, Station, Transaction } from '@/lib/api/types';
import { downloadCsvVia } from '@/lib/download';
import { dateTime, energy, money, span } from '@/lib/format';
import { localDate, periodProblem } from '@/lib/period';

const ALL_STATIONS = 'all';

/** The API's export limit (`GET /transactions/export`), checked here first. */
const EXPORT_MAX_DAYS = 31;

const DAY_MS = 86_400_000;

type SortColumn = 'startedAt' | 'energy' | 'cost';

/** What the one search box looks for; each is its own API filter. */
const SEARCH_FIELDS = [
  {
    value: 'ref',
    label: 'Session ID',
    placeholder: 'Transaction ID, or the session’s full ID',
  },
  { value: 'card', label: 'Card', placeholder: 'Start of the card number' },
  {
    value: 'driver',
    label: 'Driver',
    placeholder: 'Mobile number, email or name',
  },
] as const;
type SearchField = (typeof SEARCH_FIELDS)[number]['value'];

/** Monday of the reader's current week, the default start of the period. */
function weekStart(now = new Date()): string {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return localDate(monday);
}

/**
 * A period of local dates as the API's instants: from the first date's
 * midnight to the midnight after the last, both on the reader's clock.
 */
function periodInstants(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return {
    startedFrom: start.toISOString(),
    startedBefore: end.toISOString(),
  };
}

export function SessionsBoard() {
  const defaults = useMemo(
    () => ({
      from: weekStart(),
      to: localDate(new Date()),
      station: ALL_STATIONS,
      by: 'ref',
      q: '',
      open: '',
      flagged: '',
      sort: 'startedAt',
      dir: 'desc',
      page: '1',
      size: '50',
    }),
    [],
  );
  const [state, update] = useUrlState(defaults);

  const by = (
    SEARCH_FIELDS.some((field) => field.value === state.by) ? state.by : 'ref'
  ) as SearchField;
  const sort: SortState<SortColumn> = {
    column: (['startedAt', 'energy', 'cost'].includes(state.sort)
      ? state.sort
      : 'startedAt') as SortColumn,
    direction: state.dir === 'asc' ? 'asc' : 'desc',
  };
  const page = Math.max(1, Number.parseInt(state.page, 10) || 1);
  const size = [25, 50, 100].includes(Number(state.size))
    ? Number(state.size)
    : 50;
  const openOnly = state.open === 'true';
  const flaggedOnly = state.flagged === 'true';

  // Typing waits for a pause before it becomes a request, and a new search
  // goes back to the first page.
  const [text, setText] = useState(state.q);
  const settled = useDebounced(text.trim());
  useEffect(() => {
    if (settled !== state.q) update({ q: settled, page: '1' });
    // Only a settled change of the text should write the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  // "Running now" looks at every date: a session left open since last month
  // is exactly the one an operator is looking for.
  const problem = openOnly ? null : periodProblem(state.from, state.to);
  const period = useMemo(
    () =>
      !openOnly && problem === null
        ? periodInstants(state.from, state.to)
        : undefined,
    [openOnly, problem, state.from, state.to],
  );
  const searchProblem =
    by === 'driver' && state.q.length > 0 && state.q.length < 3
      ? 'Type at least 3 characters to search by driver.'
      : null;

  const filters = useMemo<Record<string, string | undefined>>(
    () => ({
      ...(period ?? {}),
      ...(state.station === ALL_STATIONS ? {} : { stationId: state.station }),
      ...(openOnly ? { open: 'true' } : {}),
      ...(flaggedOnly ? { costFlagged: 'true' } : {}),
      ...(state.q ? { [by]: state.q } : {}),
      sort: sort.column,
      order: sort.direction,
    }),
    [
      period,
      state.station,
      openOnly,
      flaggedOnly,
      state.q,
      by,
      sort.column,
      sort.direction,
    ],
  );

  // The realtime provider marks `['transactions']` stale on every session
  // event, so a running session updates here without this screen polling.
  const sessions = useQuery({
    queryKey: ['transactions', filters, page, size],
    queryFn: () =>
      apiGet<NumberedPage<Transaction>>('/transactions', {
        ...filters,
        page: String(page),
        limit: String(size),
      }),
    enabled: problem === null && searchProblem === null,
    placeholderData: keepPreviousData,
  });

  // A session carries its charger as an id. The names are fetched once and
  // joined here rather than asking for each row's station.
  const stations = useQuery({
    queryKey: ['stations'],
    queryFn: () => apiGet<Station[]>('/stations'),
  });
  const identities = useMemo(() => {
    const names = new Map<string, string>();
    for (const station of stations.data ?? [])
      names.set(station.id, station.identity);
    return names;
  }, [stations.data]);
  const stationItems = useMemo(
    () => [
      { value: ALL_STATIONS, label: 'Every charger' },
      ...[...(stations.data ?? [])]
        .sort((a, b) => a.identity.localeCompare(b.identity))
        .map((station) => ({ value: station.id, label: station.identity })),
    ],
    [stations.data],
  );

  const exportDays = period
    ? (Date.parse(period.startedBefore) - Date.parse(period.startedFrom)) /
      DAY_MS
    : Infinity;
  const exportProblem = openOnly
    ? 'Turn off “Running now” and pick a period to export.'
    : problem
      ? problem
      : exportDays > EXPORT_MAX_DAYS + 1 // a DST day can be 25 hours
        ? `An export covers at most ${EXPORT_MAX_DAYS} days. Shorten the period.`
        : null;
  const exportCsv = useMutation({
    mutationFn: () =>
      downloadCsvVia(
        '/api/cv',
        '/transactions/export',
        filters,
        `sessions-${state.from}-to-${state.to}.csv`,
      ),
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered =
    state.station !== ALL_STATIONS || openOnly || flaggedOnly || state.q !== '';
  const reset = () => {
    setText('');
    update({
      station: ALL_STATIONS,
      q: '',
      open: '',
      flagged: '',
      from: defaults.from,
      to: defaults.to,
      page: '1',
    });
  };
  const rows = sessions.data?.items ?? [];
  const field = SEARCH_FIELDS.find((option) => option.value === by)!;

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Charging sessions, newest first. Starts with this week."
      >
        <Button
          variant="outline"
          onClick={() => exportCsv.mutate()}
          disabled={exportProblem !== null || exportCsv.isPending}
          title={
            exportProblem ??
            'Up to 10,000 sessions, with the filters and order shown here'
          }
        >
          <DownloadIcon data-icon="inline-start" />
          {exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
        </Button>
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="sessions-from" className="text-xs">
            From
          </Label>
          <Input
            id="sessions-from"
            type="date"
            value={state.from}
            max={state.to}
            disabled={openOnly}
            onChange={(event) =>
              update({ from: event.target.value, page: '1' })
            }
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sessions-to" className="text-xs">
            To
          </Label>
          <Input
            id="sessions-to"
            type="date"
            value={state.to}
            min={state.from}
            disabled={openOnly}
            onChange={(event) => update({ to: event.target.value, page: '1' })}
            className="w-40"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="sessions-station" className="text-xs">
            Charger
          </Label>
          <Select
            value={state.station}
            onValueChange={(value) =>
              update({ station: value ?? ALL_STATIONS, page: '1' })
            }
            items={stationItems}
          >
            <SelectTrigger id="sessions-station" className="min-w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stationItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full space-y-1 md:w-auto">
          <Label htmlFor="sessions-search" className="text-xs">
            Search
          </Label>
          <div className="flex">
            <Select
              value={by}
              onValueChange={(value) =>
                update({ by: value ?? 'ref', page: '1' })
              }
              items={SEARCH_FIELDS.map(({ value, label }) => ({
                value,
                label,
              }))}
            >
              <SelectTrigger
                aria-label="Search by"
                className="w-32 rounded-r-none border-r-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEARCH_FIELDS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative min-w-0 flex-1">
              <SearchIcon
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                id="sessions-search"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={field.placeholder}
                className="w-full rounded-l-none pl-8 md:w-72"
                inputMode={by === 'driver' ? 'search' : 'text'}
                maxLength={255}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={openOnly ? 'default' : 'outline'}
            aria-pressed={openOnly}
            onClick={() => update({ open: openOnly ? '' : 'true', page: '1' })}
          >
            Running now
          </Button>
          <Button
            variant={flaggedOnly ? 'default' : 'outline'}
            aria-pressed={flaggedOnly}
            onClick={() =>
              update({ flagged: flaggedOnly ? '' : 'true', page: '1' })
            }
            title="The price was flagged for review: unpriced, or billed on our clock because the charger’s was not trusted."
          >
            Needs a look
          </Button>
          {filtered ||
          state.from !== defaults.from ||
          state.to !== defaults.to ? (
            <Button variant="ghost" onClick={reset}>
              <XIcon data-icon="inline-start" />
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>
      {openOnly ? (
        <p className="text-muted-foreground mb-3 text-xs">
          Running now shows every open session, whatever date it started.
        </p>
      ) : null}

      {problem ? (
        <p className="text-destructive mb-3 text-sm">{problem}</p>
      ) : null}
      {searchProblem ? (
        <p className="text-muted-foreground mb-3 text-sm">{searchProblem}</p>
      ) : null}

      {sessions.isPending && problem === null && searchProblem === null ? (
        <Loading />
      ) : null}
      {sessions.isError ? <Failed error={sessions.error} /> : null}
      {sessions.isSuccess && rows.length === 0 ? (
        <Empty>
          {filtered
            ? 'No session matches those filters in this period.'
            : 'No sessions in this period. Pick earlier dates to see older ones.'}
        </Empty>
      ) : null}

      {sessions.isSuccess && rows.length > 0 ? (
        <>
          {/* Phones: one card per session, the figures that matter on top. */}
          <ul
            className="space-y-2 transition-opacity data-[stale=true]:opacity-60 md:hidden"
            data-stale={sessions.isPlaceholderData}
          >
            {rows.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/sessions/${session.id}`}
                  className="bg-card active:bg-muted block rounded-xl border p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {identities.get(session.stationId) ?? 'Unknown charger'}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {dateTime(session.startedAt)}
                        {' — '}
                        {span(session.startedAt, session.stoppedAt)}
                      </p>
                    </div>
                    {session.isOpen ? (
                      <Badge
                        variant="outline"
                        className="border-live/50 bg-live/15 text-live-ink font-medium"
                      >
                        running
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="text-muted-foreground min-w-0 text-xs">
                      <p className="truncate">
                        {session.driver
                          ? `${session.driver.name ?? 'Driver'} ${session.driver.phone ?? ''}`
                          : session.idToken
                            ? `Card ${session.idToken}`
                            : 'No card'}
                      </p>
                      <p className="truncate">
                        Session {session.transactionRef}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="readout text-lg">
                        {energy(session.energyWh)}
                      </p>
                      <p className="text-sm">
                        <SessionCost session={session} />
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div
            className="bg-card hidden overflow-x-auto rounded-xl border transition-opacity data-[stale=true]:opacity-60 md:block"
            data-stale={sessions.isPlaceholderData}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Charger</TableHead>
                  <TableHead>Card</TableHead>
                  <TableHead>Driver</TableHead>
                  <SortableHead
                    label="Started"
                    column="startedAt"
                    sort={sort}
                    onSort={(next) =>
                      update({
                        sort: next.column,
                        dir: next.direction,
                        page: '1',
                      })
                    }
                  />
                  <TableHead>Duration</TableHead>
                  <SortableHead
                    label="Energy"
                    column="energy"
                    sort={sort}
                    onSort={(next) =>
                      update({
                        sort: next.column,
                        dir: next.direction,
                        page: '1',
                      })
                    }
                  />
                  <SortableHead
                    label="Cost"
                    column="cost"
                    sort={sort}
                    onSort={(next) =>
                      update({
                        sort: next.column,
                        dir: next.direction,
                        page: '1',
                      })
                    }
                  />
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
                    <TableCell className="font-mono text-xs">
                      {session.idToken ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {session.driver ? (
                        <>
                          {session.driver.name ?? 'No name'}
                          {session.driver.phone ? (
                            <p className="text-muted-foreground text-xs tabular-nums">
                              {session.driver.phone}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {dateTime(session.startedAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {span(session.startedAt, session.stoppedAt)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {energy(session.energyWh)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      <SessionCost session={session} />
                    </TableCell>
                    <TableCell>
                      {session.isOpen ? (
                        <Badge
                          variant="outline"
                          className="border-live/50 bg-live/15 font-medium text-live-ink"
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
          <Pager
            page={sessions.data.page}
            pageSize={size}
            total={sessions.data.total}
            capped={sessions.data.totalCapped}
            busy={sessions.isFetching}
            onPage={(next) => update({ page: String(next) })}
            onPageSize={(next) => update({ size: String(next), page: '1' })}
          />
        </>
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
