'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
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
import type { Tariff } from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { CreateTariffDialog } from './create-tariff-dialog';

export function TariffsBoard() {
  const canAdmin = useCan('admin');

  const tariffs = useQuery({
    queryKey: ['tariffs'],
    queryFn: () => apiGet<Tariff[]>('/tariffs'),
  });

  return (
    <>
      <PageHeader
        title="Tariffs"
        description="What a session costs. A price change is a new version, so a session keeps the prices it was charged under."
      >
        {canAdmin ? <CreateTariffDialog /> : null}
      </PageHeader>

      {tariffs.isPending ? <Loading /> : null}
      {tariffs.isError ? <Failed error={tariffs.error} /> : null}
      {tariffs.isSuccess && tariffs.data.length === 0 ? (
        <Empty>
          No tariffs yet. Create one, then attach it to a site or a charger from
          that page.
        </Empty>
      ) : null}

      {tariffs.isSuccess && tariffs.data.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tariff</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>In force from</TableHead>
                <TableHead>Rounding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tariffs.data.map((tariff) => (
                <TableRow key={tariff.id}>
                  <TableCell>
                    <Link
                      href={`/tariffs/${tariff.id}`}
                      className="font-medium hover:underline"
                    >
                      {tariff.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{tariff.currency}</TableCell>
                  <TableCell className="text-sm">
                    {tariff.currentVersion
                      ? `v${tariff.currentVersion.version}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {tariff.currentVersion ? (
                      dateTime(tariff.currentVersion.validFrom)
                    ) : (
                      <span className="text-muted-foreground">
                        Every version is still scheduled
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {tariff.currentVersion?.rounding ?? '—'}
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
