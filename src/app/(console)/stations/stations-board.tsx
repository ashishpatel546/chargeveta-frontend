'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AddStationDialog } from './add-station-dialog';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import { LiveBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
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
import type { Site, Station } from '@/lib/api/types';
import { since } from '@/lib/format';

export function StationsBoard() {
  const [filter, setFilter] = useState('');
  const canAdmin = useCan('admin');

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

  const siteNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const site of sites.data ?? []) names.set(site.id, site.name);
    return names;
  }, [sites.data]);

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const all = stations.data ?? [];
    if (!needle) return all;
    return all.filter((station) =>
      [
        station.identity,
        station.vendor,
        station.model,
        station.serialNumber,
        siteNames.get(station.locationId ?? ''),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [filter, stations.data, siteNames]);

  return (
    <>
      <PageHeader
        title="Chargers"
        description="Every charging station registered to this operator."
      >
        {canAdmin ? <AddStationDialog /> : null}
      </PageHeader>

      <Input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Filter by name, site, vendor or serial number"
        className="mb-4 max-w-sm"
        aria-label="Filter chargers"
      />

      {stations.isPending ? <Loading /> : null}
      {stations.isError ? <Failed error={stations.error} /> : null}
      {stations.isSuccess && rows.length === 0 ? (
        <Empty>
          {stations.data.length === 0
            ? 'No chargers yet. Add one, then give it this system’s WebSocket address and its password.'
            : 'No charger matches that.'}
        </Empty>
      ) : null}

      {stations.isSuccess && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Charger</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>OCPP</TableHead>
                <TableHead>Last heard from</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((station) => (
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
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {station.locationId
                      ? (siteNames.get(station.locationId) ?? 'Unknown site')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {station.ocppVersion}
                  </TableCell>
                  <TableCell className="text-sm">
                    {since(station.lastSeenAt)}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <LiveBadge lastSeenAt={station.lastSeenAt} />
                    {station.quarantinedAt ? (
                      <Badge variant="destructive">quarantined</Badge>
                    ) : null}
                    {!station.isActive ? (
                      <Badge variant="outline">disabled</Badge>
                    ) : null}
                    {!station.hasCredential ? (
                      <Badge variant="outline" className="text-amber-600">
                        no password
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
