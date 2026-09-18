'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DownloadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import type { SessionReport } from '@/lib/api/types';
import { dateTime, energy, money } from '@/lib/format';
import { downloadCsv, lastThirtyDays, periodProblem } from './period';
import { PeriodControls } from './period-controls';

type Grouping = SessionReport['groupBy'];

const GROUPINGS: { value: Grouping; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'month', label: 'Month' },
  { value: 'site', label: 'Site' },
  { value: 'station', label: 'Charger' },
];

/**
 * Sessions, energy and revenue over a period.
 *
 * Rows are per currency, because amounts in different currencies are never
 * added together, and revenue is receipts less credit notes — so a period read
 * again later can differ, which is what `asOf` is for.
 */
export function SessionReportPanel() {
  // Lazily, because today is read from the clock and a render must not.
  const [period, setPeriod] = useState(lastThirtyDays);
  const { from, to } = period;
  const [groupBy, setGroupBy] = useState<Grouping>('day');
  const [siteId, setSiteId] = useState('all');

  const problem = periodProblem(from, to);
  const params = {
    from,
    to,
    groupBy,
    ...(siteId === 'all' ? {} : { siteId }),
  };

  const report = useQuery({
    queryKey: ['report', 'sessions', from, to, groupBy, siteId],
    queryFn: () => apiGet<SessionReport>('/reports/sessions', params),
    enabled: problem === null,
  });

  const csv = useMutation({
    mutationFn: () =>
      downloadCsv(
        '/reports/sessions',
        params,
        `sessions-${groupBy}-${from}-to-${to}.csv`,
      ),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PeriodControls
        idPrefix="sessions"
        from={from}
        to={to}
        siteId={siteId}
        onFrom={(value) => setPeriod((current) => ({ ...current, from: value }))}
        onTo={(value) => setPeriod((current) => ({ ...current, to: value }))}
        onSite={setSiteId}
      >
        <div className="space-y-1">
          <Label htmlFor="sessions-group" className="text-xs">
            Grouped by
          </Label>
          <Select
            value={groupBy}
            onValueChange={(value) =>
              setGroupBy((value as Grouping | null) ?? 'day')
            }
          >
            <SelectTrigger id="sessions-group" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUPINGS.map((grouping) => (
                <SelectItem key={grouping.value} value={grouping.value}>
                  {grouping.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          onClick={() => csv.mutate()}
          disabled={problem !== null || csv.isPending}
        >
          <DownloadIcon />
          {csv.isPending ? 'Preparing…' : 'CSV'}
        </Button>
      </PeriodControls>

      {problem ? (
        <Alert>
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      ) : null}

      {report.isPending && problem === null ? <Loading /> : null}
      {report.isError ? <Failed error={report.error} /> : null}
      {report.isSuccess && report.data.rows.length === 0 ? (
        <Empty>No sessions closed in that period.</Empty>
      ) : null}

      {report.isSuccess && report.data.rows.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {groupBy === 'day'
                      ? 'Day'
                      : groupBy === 'month'
                        ? 'Month'
                        : groupBy === 'site'
                          ? 'Site'
                          : 'Charger'}
                  </TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Unpriced</TableHead>
                  <TableHead className="text-right">Energy</TableHead>
                  <TableHead className="text-right">Billed minutes</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.data.rows.map((row) => (
                  <TableRow key={`${row.key}-${row.currency ?? 'none'}`}>
                    <TableCell className="text-sm">
                      {/* The key of a day or month row is already a local date
                          in the site's zone, so it is shown as it came rather
                          than re-read in the reader's. */}
                      {row.label ?? row.key}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.currency ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.sessions}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.unpricedSessions}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {energy(row.energyWh)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.billedMinutes}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {money(row.netMinor, row.currency ?? undefined)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {money(row.taxMinor, row.currency ?? undefined)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {money(row.grossMinor, row.currency ?? undefined)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-muted-foreground mt-2 text-xs">
            Computed {dateTime(report.data.asOf)}. Late events change days that
            have already passed, so the same period can read differently later.
          </p>
        </>
      ) : null}
    </>
  );
}
