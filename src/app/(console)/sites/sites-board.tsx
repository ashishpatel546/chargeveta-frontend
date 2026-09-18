'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet } from '@/lib/api/client';
import type { Site, Tariff } from '@/lib/api/types';
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

export function SitesBoard() {
  const canAdmin = useCan('admin');

  const sites = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiGet<Site[]>('/locations'),
  });

  // A site holds its tariff as an id, so the names are fetched once and joined
  // here rather than asked for per row.
  const tariffs = useQuery({
    queryKey: ['tariffs'],
    queryFn: () => apiGet<Tariff[]>('/tariffs'),
  });

  const tariffNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const tariff of tariffs.data ?? []) names.set(tariff.id, tariff.name);
    return names;
  }, [tariffs.data]);

  return (
    <>
      <PageHeader
        title="Sites"
        description="Where the chargers stand. A site carries the tariff, the tax rate and the time zone its sessions are billed by."
      >
        {canAdmin ? <SiteDialog tariffs={tariffs.data ?? []} /> : null}
      </PageHeader>

      {sites.isPending ? <Loading /> : null}
      {sites.isError ? <Failed error={sites.error} /> : null}
      {sites.isSuccess && sites.data.length === 0 ? (
        <Empty>
          No sites yet. Add one, then give its chargers a site so their sessions
          have a tariff and a tax rate.
        </Empty>
      ) : null}

      {sites.isSuccess && sites.data.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>Where</TableHead>
                <TableHead>Time zone</TableHead>
                <TableHead>Tariff</TableHead>
                <TableHead>GST</TableHead>
                <TableHead>GST state</TableHead>
                <TableHead>Coordinates</TableHead>
                {canAdmin ? <TableHead>Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.data.map((site) => (
                <TableRow key={site.id}>
                  <TableCell className="font-medium">{site.name}</TableCell>
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
      ) : null}
    </>
  );
}
