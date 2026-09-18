'use client';

import { useQuery } from '@tanstack/react-query';
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
import type { MeterReading } from '@/lib/api/types';
import { dateTime, energy, power } from '@/lib/format';

/**
 * The API sends up to 5000 readings for one session, and an overnight session
 * sampled every few seconds reaches that. Only the newest are put in the DOM:
 * a table of five thousand rows makes the page unusable, and the question this
 * screen answers — what has the meter been doing lately — is at the end.
 */
const SHOWN = 500;

export function SessionReadings({ id }: { id: string }) {
  const readings = useQuery({
    queryKey: ['transactions', id, 'readings'],
    queryFn: () => apiGet<MeterReading[]>(`/transactions/${id}/readings`),
  });

  if (readings.isPending) return <Loading rows={4} />;
  if (readings.isError) return <Failed error={readings.error} />;
  if (readings.data.length === 0) {
    return (
      <Empty>
        No readings. A charger that reports none leaves the session with no
        energy of its own.
      </Empty>
    );
  }

  // Oldest first from the API, so the newest are at the end.
  const rows = readings.data.slice(-SHOWN);

  return (
    <div className="space-y-2">
      {readings.data.length > rows.length ? (
        <p className="text-muted-foreground text-xs">
          Showing the most recent {rows.length} of {readings.data.length}{' '}
          readings.
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sampled</TableHead>
              <TableHead>Context</TableHead>
              <TableHead>Energy register</TableHead>
              <TableHead>Power</TableHead>
              <TableHead>Battery</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((reading) => (
              <TableRow key={reading.id}>
                <TableCell className="text-sm">
                  {dateTime(reading.sampledAt)}
                </TableCell>
                <TableCell className="text-sm">
                  {reading.context ?? '—'}
                </TableCell>
                <TableCell className="text-sm">
                  {energy(reading.energyRegisterWh)}
                </TableCell>
                <TableCell className="text-sm">
                  {power(reading.powerActiveImportW)}
                </TableCell>
                <TableCell className="text-sm">
                  {reading.socPercent === undefined
                    ? '—'
                    : `${reading.socPercent}%`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
