'use client';

import { useQuery } from '@tanstack/react-query';
import { DownloadIcon, SearchIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AddStationDialog } from './add-station-dialog';
import { LiveStrip } from './live-strip';
import {
  downloadRowsCsv,
  FilterDisclosure,
  Pager,
  SortableHead,
  useClientTable,
  useUrlState,
  type SortState,
} from '@/components/data-table';
import { FilterSelect } from '@/components/audit-log';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import {
  ConnectorChip,
  liveness,
  LiveBadge,
  useMinute,
} from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet } from '@/lib/api/client';
import type {
  BoardConnector,
  Site,
  Station,
  StationBoard,
} from '@/lib/api/types';
import { localDate } from '@/lib/period';
import { since } from '@/lib/format';

const ALL = 'all';
const NO_SITE = 'none';

type SortColumn = 'identity' | 'site' | 'ocpp' | 'lastSeen';

const STATUS_ITEMS = [
  { value: ALL, label: 'Any connection' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'silent', label: 'Not heard from lately' },
  { value: 'never', label: 'Never seen' },
];

/** Which connectors a charger must have at least one of. */
const CONNECTOR_ITEMS = [
  { value: ALL, label: 'Any connector' },
  { value: 'charging', label: 'Charging' },
  { value: 'Available', label: 'Available' },
  { value: 'Faulted', label: 'Faulted' },
  { value: 'Unavailable', label: 'Unavailable' },
];

/** The reader's midnight, which "Energy today" counts from. */
function todayStart(): string {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return midnight.toISOString();
}

function chipLabel(connector: BoardConnector, all: BoardConnector[]) {
  if (all.length < 2) return undefined;
  const sameEvse = all.filter((c) => c.evseNumber === connector.evseNumber);
  return sameEvse.length > 1
    ? `${connector.evseNumber}/${connector.connectorNumber}`
    : String(connector.evseNumber);
}

const OCPP_ITEMS = [
  { value: ALL, label: 'Any OCPP version' },
  { value: '1.6', label: 'OCPP 1.6' },
  { value: '2.0.1', label: 'OCPP 2.0.1' },
  { value: '2.1', label: 'OCPP 2.1' },
];

const FLAG_ITEMS = [
  { value: ALL, label: 'Any state' },
  { value: 'quarantined', label: 'Quarantined' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'no-password', label: 'No password' },
];

export function StationsBoard() {
  const canAdmin = useCan('admin');
  const now = useMinute();
  const [state, update] = useUrlState({
    q: '',
    site: ALL,
    status: ALL,
    conn: ALL,
    ocpp: ALL,
    flag: ALL,
    sort: 'identity',
    dir: 'asc',
    page: '1',
    size: '50',
  });
  const sort: SortState<SortColumn> = {
    column: (['identity', 'site', 'ocpp', 'lastSeen'].includes(state.sort)
      ? state.sort
      : 'identity') as SortColumn,
    direction: state.dir === 'desc' ? 'desc' : 'asc',
  };
  const size = [25, 50, 100].includes(Number(state.size))
    ? Number(state.size)
    : 50;

  // The list filters as you type; the URL catches up, so it is not rewritten
  // per keystroke.
  const [text, setText] = useState(state.q);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (text !== state.q) update({ q: text, page: '1' });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const stations = useQuery({
    queryKey: ['stations'],
    queryFn: () => apiGet<Station[]>('/stations'),
  });

  // The API returns a station's site as an id, so the names are fetched once
  // and joined here rather than asking for each one.
  const sites = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiGet<Site[]>('/locations'),
  });

  // The live layer: connector statuses and the strip's figures. Refreshed by
  // the realtime provider on every connector and session event (it marks
  // `['stations']` stale), and each minute so "online" ages on its own.
  const [midnight] = useState(todayStart);
  const board = useQuery({
    queryKey: ['stations', 'board', midnight],
    queryFn: () => apiGet<StationBoard>('/stations/board', { since: midnight }),
    refetchInterval: 60_000,
  });
  const connectorsOf = useMemo(() => {
    const map = new Map<string, BoardConnector[]>();
    for (const row of board.data?.stations ?? []) {
      map.set(row.stationId, row.connectors);
    }
    return map;
  }, [board.data]);

  const siteNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const site of sites.data ?? []) names.set(site.id, site.name);
    return names;
  }, [sites.data]);
  const siteItems = useMemo(
    () => [
      { value: ALL, label: 'Every site' },
      { value: NO_SITE, label: 'No site' },
      ...[...(sites.data ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((site) => ({ value: site.id, label: site.name })),
    ],
    [sites.data],
  );

  const matching = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return (stations.data ?? []).filter((station) => {
      if (state.site === NO_SITE && station.locationId) return false;
      if (
        state.site !== ALL &&
        state.site !== NO_SITE &&
        station.locationId !== state.site
      ) {
        return false;
      }
      const live = liveness(station.lastSeenAt, now);
      if (
        state.status === 'offline'
          ? live === 'online'
          : state.status !== ALL && live !== state.status
      ) {
        return false;
      }
      if (state.conn !== ALL) {
        const connectors = connectorsOf.get(station.id) ?? [];
        const match = connectors.some((c) =>
          state.conn === 'charging'
            ? c.charging
            : c.status === state.conn && !c.charging,
        );
        if (!match) return false;
      }
      if (state.ocpp !== ALL && station.ocppVersion !== state.ocpp)
        return false;
      if (state.flag === 'quarantined' && !station.quarantinedAt) return false;
      if (state.flag === 'disabled' && station.isActive) return false;
      if (state.flag === 'no-password' && station.hasCredential) return false;
      if (!needle) return true;
      return [
        station.identity,
        station.vendor,
        station.model,
        station.serialNumber,
        station.firmwareVersion,
        siteNames.get(station.locationId ?? ''),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [
    stations.data,
    text,
    state.site,
    state.status,
    state.conn,
    state.ocpp,
    state.flag,
    siteNames,
    connectorsOf,
    now,
  ]);

  const table = useClientTable(
    matching,
    sort,
    {
      identity: (station) => station.identity,
      site: (station) => siteNames.get(station.locationId ?? ''),
      ocpp: (station) => station.ocppVersion,
      lastSeen: (station) =>
        station.lastSeenAt ? Date.parse(station.lastSeenAt) : null,
    },
    Math.max(1, Number.parseInt(state.page, 10) || 1),
    size,
  );

  const activeFilters = [
    state.site,
    state.status,
    state.conn,
    state.ocpp,
    state.flag,
  ].filter((value) => value !== ALL).length;
  const filtered = text.trim() !== '' || activeFilters > 0;
  const reset = () => {
    setText('');
    update({
      q: '',
      site: ALL,
      status: ALL,
      conn: ALL,
      ocpp: ALL,
      flag: ALL,
      page: '1',
    });
  };
  const onSort = (next: SortState<SortColumn>) =>
    update({ sort: next.column, dir: next.direction, page: '1' });

  const exportCsv = () =>
    downloadRowsCsv(
      `chargers-${localDate(new Date())}.csv`,
      [
        { header: 'identity', value: (s: Station) => s.identity },
        { header: 'site', value: (s) => siteNames.get(s.locationId ?? '') },
        { header: 'vendor', value: (s) => s.vendor },
        { header: 'model', value: (s) => s.model },
        { header: 'serialNumber', value: (s) => s.serialNumber },
        { header: 'firmwareVersion', value: (s) => s.firmwareVersion },
        { header: 'ocppVersion', value: (s) => s.ocppVersion },
        { header: 'connection', value: (s) => liveness(s.lastSeenAt, now) },
        {
          header: 'connectors',
          value: (s) =>
            (connectorsOf.get(s.id) ?? [])
              .map(
                (c) =>
                  `${c.evseNumber}/${c.connectorNumber} ${c.charging ? 'Charging' : c.status}`,
              )
              .join('; '),
        },
        { header: 'lastSeenAt', value: (s) => s.lastSeenAt },
        { header: 'active', value: (s) => String(s.isActive) },
        { header: 'quarantinedAt', value: (s) => s.quarantinedAt },
      ],
      table.sorted,
    );

  return (
    <>
      <PageHeader
        title="Chargers"
        description="Every charging station registered to this operator."
      >
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={table.total === 0}
          title="The chargers shown, with the filters and order here"
        >
          <DownloadIcon data-icon="inline-start" />
          Export CSV
        </Button>
        {canAdmin ? <AddStationDialog /> : null}
      </PageHeader>

      <LiveStrip
        board={board.data}
        onFaulted={() =>
          update({ conn: 'Faulted', status: 'online', page: '1' })
        }
        onOffline={() => update({ status: 'offline', conn: ALL, page: '1' })}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full md:w-auto">
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Name, site, vendor, model or serial number"
            className="w-full pl-8 md:w-80"
            aria-label="Search chargers"
          />
        </div>
        <FilterDisclosure active={activeFilters}>
          <FilterSelect
            value={state.site}
            onChange={(value) => update({ site: value, page: '1' })}
            items={siteItems}
            label="Site"
            className="w-full md:w-48"
          />
          <FilterSelect
            value={state.conn}
            onChange={(value) => update({ conn: value, page: '1' })}
            items={CONNECTOR_ITEMS}
            label="Connector"
            className="w-full md:w-48"
          />
          <FilterSelect
            value={state.status}
            onChange={(value) => update({ status: value, page: '1' })}
            items={STATUS_ITEMS}
            label="Connection"
            className="w-full md:w-48"
          />
          <FilterSelect
            value={state.ocpp}
            onChange={(value) => update({ ocpp: value, page: '1' })}
            items={OCPP_ITEMS}
            label="OCPP version"
            className="w-full md:w-52"
          />
          <FilterSelect
            value={state.flag}
            onChange={(value) => update({ flag: value, page: '1' })}
            items={FLAG_ITEMS}
            label="State"
            className="w-full md:w-44"
          />
        </FilterDisclosure>
        {filtered ? (
          <Button variant="ghost" onClick={reset}>
            <XIcon data-icon="inline-start" />
            Clear filters
          </Button>
        ) : null}
      </div>

      {stations.isPending ? <Loading /> : null}
      {stations.isError ? <Failed error={stations.error} /> : null}
      {stations.isSuccess && table.total === 0 ? (
        <Empty>
          {stations.data.length === 0
            ? 'No chargers yet. Add one, then give it this system’s WebSocket address and its password.'
            : 'No charger matches those filters.'}
        </Empty>
      ) : null}

      {stations.isSuccess && table.total > 0 ? (
        <>
          {/* Phones: one card per charger, its connectors where a thumb can see them. */}
          <ul className="space-y-2 md:hidden">
            {table.pageRows.map((station) => (
              <li key={station.id}>
                <Link
                  href={`/stations/${station.id}`}
                  className="bg-card active:bg-muted block rounded-xl border p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{station.identity}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {station.locationId
                          ? (siteNames.get(station.locationId) ??
                            'Unknown site')
                          : 'No site'}
                        {' — '}
                        heard from {since(station.lastSeenAt)}
                      </p>
                    </div>
                    <LiveBadge lastSeenAt={station.lastSeenAt} />
                  </div>
                  <Connectors
                    connectors={connectorsOf.get(station.id)}
                    stale={liveness(station.lastSeenAt, now) !== 'online'}
                    className="mt-3"
                  />
                  <Flags station={station} className="mt-2" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="bg-card hidden overflow-x-auto rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Charger"
                    column="identity"
                    sort={sort}
                    onSort={onSort}
                    firstDirection="asc"
                  />
                  <SortableHead
                    label="Site"
                    column="site"
                    sort={sort}
                    onSort={onSort}
                    firstDirection="asc"
                  />
                  <TableHead>Connectors</TableHead>
                  <SortableHead
                    label="Last heard from"
                    column="lastSeen"
                    sort={sort}
                    onSort={onSort}
                  />
                  <SortableHead
                    label="OCPP"
                    column="ocpp"
                    sort={sort}
                    onSort={onSort}
                    firstDirection="asc"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.pageRows.map((station) => (
                  <TableRow key={station.id}>
                    <TableCell>
                      <Link
                        href={`/stations/${station.id}`}
                        className="font-medium hover:underline"
                      >
                        {station.identity}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {[station.vendor, station.model]
                          .filter(Boolean)
                          .join(' ') || '—'}
                      </p>
                      <Flags station={station} className="mt-1" />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {station.locationId
                        ? (siteNames.get(station.locationId) ?? 'Unknown site')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Connectors
                        connectors={connectorsOf.get(station.id)}
                        stale={liveness(station.lastSeenAt, now) !== 'online'}
                      />
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <LiveBadge lastSeenAt={station.lastSeenAt} />
                        <span className="text-muted-foreground whitespace-nowrap">
                          {since(station.lastSeenAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {station.ocppVersion}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager
            page={table.page}
            pageSize={size}
            total={table.total}
            onPage={(next) => update({ page: String(next) })}
            onPageSize={(next) => update({ size: String(next), page: '1' })}
          />
        </>
      ) : null}
    </>
  );
}

/** A charger's connectors as chips, or a quiet note when none are known. */
function Connectors({
  connectors,
  stale,
  className,
}: {
  connectors: BoardConnector[] | undefined;
  stale: boolean;
  className?: string;
}) {
  if (!connectors)
    return <span className="text-muted-foreground text-xs">…</span>;
  if (connectors.length === 0) {
    return (
      <span className={`text-muted-foreground text-xs ${className ?? ''}`}>
        No connectors reported yet
      </span>
    );
  }
  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ''}`}>
      {connectors.map((connector) => (
        <span
          key={`${connector.evseNumber}-${connector.connectorNumber}`}
          title={[
            `EVSE ${connector.evseNumber}, connector ${connector.connectorNumber}`,
            connector.connectorType,
            stale ? `last reported ${since(connector.statusUpdatedAt)}` : null,
          ]
            .filter(Boolean)
            .join('\n')}
        >
          <ConnectorChip
            status={connector.status}
            charging={connector.charging}
            stale={stale}
            label={chipLabel(connector, connectors)}
          />
        </span>
      ))}
    </div>
  );
}

/** What an operator must know about a charger before anything else. */
function Flags({
  station,
  className,
}: {
  station: Station;
  className?: string;
}) {
  if (station.isActive && !station.quarantinedAt && station.hasCredential)
    return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ''}`}>
      {station.quarantinedAt ? (
        <Badge variant="destructive">quarantined</Badge>
      ) : null}
      {!station.isActive ? <Badge variant="outline">disabled</Badge> : null}
      {!station.hasCredential ? (
        <Badge variant="outline" className="text-caution-ink">
          no password
        </Badge>
      ) : null}
    </div>
  );
}
