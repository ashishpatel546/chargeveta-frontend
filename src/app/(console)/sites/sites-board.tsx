'use client';

import { useQuery } from '@tanstack/react-query';
import { DownloadIcon, SearchIcon, XIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { MapPinOffIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FilterSelect } from '@/components/audit-log';
import {
  downloadRowsCsv,
  Pager,
  SortableHead,
  useClientTable,
  useUrlState,
  type SortState,
} from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
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
import type { Site, Station, StationBoard, Tariff } from '@/lib/api/types';
import { liveness, useMinute } from '@/components/status-badge';
import type { SiteLoad } from './sites-map';
import { localDate } from '@/lib/period';
import { DeleteSiteDialog } from './delete-site-dialog';
import { SiteDialog } from './site-dialog';

/** Basis points as a rate: 1800 is 18%. */
function gstRate(bp: number | null): string {
  if (bp === null) return '—';
  return `${(bp / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}%`;
}

function coordinates(site: Site): string {
  if (site.latitude === null || site.longitude === null) return '—';
  return `${Number(site.latitude).toFixed(5)}, ${Number(site.longitude).toFixed(5)}`;
}

// Leaflet touches `window` when it loads, so the map renders on the client only.
const SitesMap = dynamic(() => import('./sites-map').then((m) => m.SitesMap), {
  ssr: false,
  loading: () => (
    <div className="bg-muted h-64 animate-pulse rounded-xl md:h-80" />
  ),
});

const ALL = 'all';
const NONE = 'none';

type SortColumn = 'name' | 'city' | 'tariff' | 'gst';

export function SitesBoard() {
  const canAdmin = useCan('admin');
  const [state, update] = useUrlState({
    q: '',
    tariff: ALL,
    zone: ALL,
    sort: 'name',
    dir: 'asc',
    page: '1',
    size: '50',
  });
  const sort: SortState<SortColumn> = {
    column: (['name', 'city', 'tariff', 'gst'].includes(state.sort)
      ? state.sort
      : 'name') as SortColumn,
    direction: state.dir === 'desc' ? 'desc' : 'asc',
  };
  const size = [25, 50, 100].includes(Number(state.size))
    ? Number(state.size)
    : 50;

  // The list filters as you type; the URL catches up after a pause.
  const [text, setText] = useState(state.q);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (text !== state.q) update({ q: text, page: '1' });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const sites = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiGet<Site[]>('/locations'),
  });

  // A site holds its tariff as an id, so the names are fetched once and joined
  // here rather than asked for per row.
  // For the map's pins: how many chargers stand at each site, and how many
  // are online or charging. Both lists are shared with the Chargers page.
  const now = useMinute();
  const stations = useQuery({
    queryKey: ['stations'],
    queryFn: () => apiGet<Station[]>('/stations'),
  });
  const board = useQuery({
    queryKey: ['stations', 'board', 'sites-map'],
    queryFn: () => apiGet<StationBoard>('/stations/board'),
    refetchInterval: 60_000,
  });
  const load = useMemo(() => {
    const charging = new Set(
      (board.data?.stations ?? [])
        .filter((row) => row.connectors.some((c) => c.charging))
        .map((row) => row.stationId),
    );
    const bySite = new Map<string, SiteLoad>();
    for (const station of stations.data ?? []) {
      if (!station.locationId) continue;
      const entry = bySite.get(station.locationId) ?? {
        chargers: 0,
        online: 0,
        charging: 0,
      };
      entry.chargers += 1;
      if (liveness(station.lastSeenAt, now) === 'online') entry.online += 1;
      if (charging.has(station.id)) entry.charging += 1;
      bySite.set(station.locationId, entry);
    }
    return bySite;
  }, [stations.data, board.data, now]);

  const tariffs = useQuery({
    queryKey: ['tariffs'],
    queryFn: () => apiGet<Tariff[]>('/tariffs'),
  });

  const tariffNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const tariff of tariffs.data ?? []) names.set(tariff.id, tariff.name);
    return names;
  }, [tariffs.data]);

  const tariffItems = useMemo(
    () => [
      { value: ALL, label: 'Any tariff' },
      { value: NONE, label: 'No tariff' },
      ...[...(tariffs.data ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((tariff) => ({ value: tariff.id, label: tariff.name })),
    ],
    [tariffs.data],
  );
  const zoneItems = useMemo(() => {
    const zones = new Set<string>();
    for (const site of sites.data ?? [])
      if (site.timeZone) zones.add(site.timeZone);
    return [
      { value: ALL, label: 'Any time zone' },
      { value: NONE, label: 'No time zone' },
      ...[...zones].sort().map((zone) => ({ value: zone, label: zone })),
    ];
  }, [sites.data]);

  const matching = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return (sites.data ?? []).filter((site) => {
      if (state.tariff === NONE && site.tariffId) return false;
      if (
        state.tariff !== ALL &&
        state.tariff !== NONE &&
        site.tariffId !== state.tariff
      ) {
        return false;
      }
      if (state.zone === NONE && site.timeZone) return false;
      if (
        state.zone !== ALL &&
        state.zone !== NONE &&
        site.timeZone !== state.zone
      ) {
        return false;
      }
      if (!needle) return true;
      return [
        site.name,
        site.city,
        site.address,
        site.postalCode,
        site.country,
        site.gstStateCode,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [sites.data, text, state.tariff, state.zone]);

  const table = useClientTable(
    matching,
    sort,
    {
      name: (site) => site.name,
      city: (site) => site.city,
      tariff: (site) => tariffNames.get(site.tariffId ?? ''),
      gst: (site) => site.gstRateBp,
    },
    Math.max(1, Number.parseInt(state.page, 10) || 1),
    size,
  );

  const filtered =
    text.trim() !== '' || state.tariff !== ALL || state.zone !== ALL;
  const reset = () => {
    setText('');
    update({ q: '', tariff: ALL, zone: ALL, page: '1' });
  };
  const onSort = (next: SortState<SortColumn>) =>
    update({ sort: next.column, dir: next.direction, page: '1' });

  const exportCsv = () =>
    downloadRowsCsv(
      `sites-${localDate(new Date())}.csv`,
      [
        { header: 'name', value: (site: Site) => site.name },
        { header: 'address', value: (site) => site.address },
        { header: 'city', value: (site) => site.city },
        { header: 'postalCode', value: (site) => site.postalCode },
        { header: 'country', value: (site) => site.country },
        { header: 'timeZone', value: (site) => site.timeZone },
        {
          header: 'tariff',
          value: (site) => tariffNames.get(site.tariffId ?? ''),
        },
        { header: 'gstRateBp', value: (site) => site.gstRateBp },
        { header: 'gstStateCode', value: (site) => site.gstStateCode },
        { header: 'latitude', value: (site) => site.latitude },
        { header: 'longitude', value: (site) => site.longitude },
      ],
      table.sorted,
    );

  return (
    <>
      <PageHeader
        title="Sites"
        description="Where the chargers stand. A site carries the tariff, the tax rate and the time zone its sessions are billed by."
      >
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={table.total === 0}
          title="The sites shown, with the filters and order here"
        >
          <DownloadIcon data-icon="inline-start" />
          Export CSV
        </Button>
        {canAdmin ? <SiteDialog tariffs={tariffs.data ?? []} /> : null}
      </PageHeader>

      {sites.isSuccess && sites.data.length > 0 ? (
        <div className="mb-5 space-y-2">
          <SitesMap sites={matching} load={load} />
          {matching.some(
            (site) => site.latitude === null || site.longitude === null,
          ) ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <MapPinOffIcon aria-hidden className="size-3.5" />
              {(() => {
                const missing = matching.filter(
                  (site) => site.latitude === null || site.longitude === null,
                ).length;
                return `${missing} ${missing === 1 ? 'site has' : 'sites have'} no coordinates, so ${missing === 1 ? 'it is' : 'they are'} not on the map and drivers won’t find ${missing === 1 ? 'it' : 'them'} in Nearby. Add them with Edit.`;
              })()}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Name, city, address, PIN code or GST state"
            className="w-80 pl-8"
            aria-label="Search sites"
          />
        </div>
        <FilterSelect
          value={state.tariff}
          onChange={(value) => update({ tariff: value, page: '1' })}
          items={tariffItems}
          label="Tariff"
        />
        <FilterSelect
          value={state.zone}
          onChange={(value) => update({ zone: value, page: '1' })}
          items={zoneItems}
          label="Time zone"
        />
        {filtered ? (
          <Button variant="ghost" onClick={reset}>
            <XIcon data-icon="inline-start" />
            Clear filters
          </Button>
        ) : null}
      </div>

      {sites.isPending ? <Loading /> : null}
      {sites.isError ? <Failed error={sites.error} /> : null}
      {sites.isSuccess && sites.data.length === 0 ? (
        <Empty>
          No sites yet. Add one, then give its chargers a site so their sessions
          have a tariff and a tax rate.
        </Empty>
      ) : null}

      {sites.isSuccess && sites.data.length > 0 && table.total === 0 ? (
        <Empty>No site matches those filters.</Empty>
      ) : null}

      {sites.isSuccess && table.total > 0 ? (
        <>
          <div className="bg-card overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Site"
                    column="name"
                    sort={sort}
                    onSort={onSort}
                    firstDirection="asc"
                  />
                  <SortableHead
                    label="Where"
                    column="city"
                    sort={sort}
                    onSort={onSort}
                    firstDirection="asc"
                  />
                  <TableHead>Time zone</TableHead>
                  <SortableHead
                    label="Tariff"
                    column="tariff"
                    sort={sort}
                    onSort={onSort}
                    firstDirection="asc"
                  />
                  <SortableHead
                    label="GST"
                    column="gst"
                    sort={sort}
                    onSort={onSort}
                  />
                  <TableHead>GST state</TableHead>
                  <TableHead>Coordinates</TableHead>
                  {canAdmin ? <TableHead>Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.pageRows.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/sites/${site.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {site.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {site.city ?? '—'}
                      <p className="text-muted-foreground text-xs">
                        {[site.address, site.postalCode, site.country]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {site.timeZone ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {site.tariffId
                        ? (tariffNames.get(site.tariffId) ?? 'Unknown tariff')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {gstRate(site.gstRateBp)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {site.gstStateCode ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                      {coordinates(site)}
                    </TableCell>
                    {canAdmin ? (
                      <TableCell className="space-x-1 whitespace-nowrap">
                        <SiteDialog site={site} tariffs={tariffs.data ?? []} />
                        <DeleteSiteDialog site={site} />
                      </TableCell>
                    ) : null}
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
