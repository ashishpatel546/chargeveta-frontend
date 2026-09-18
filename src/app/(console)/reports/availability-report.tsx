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
import type { AvailabilityReport, Station } from '@/lib/api/types';
import { dateTime, hours, percent } from '@/lib/format';
import { downloadCsv, lastThirtyDays, periodProblem } from './period';
import { PeriodControls } from './period-controls';

/**
 * How much of the time each connector could take a car.
 *
 * `availability` is up over up plus down, so time nobody could account for —
 * a charger that was not connected, or had never reported a status — is left
 * out of it and shown as coverage instead. A low coverage is a reason to read
 * the availability beside it carefully rather than a fault in itself.
 */
export function AvailabilityReportPanel() {
  // Lazily, because today is read from the clock and a render must not.
  const [period, setPeriod] = useState(lastThirtyDays);
  const { from, to } = period;
  const [siteId, setSiteId] = useState('all');
  const [stationId, setStationId] = useState('all');

  const stations = useQuery({
    queryKey: ['stations'],
    queryFn: () => apiGet<Station[]>('/stations'),
  });

  const problem = periodProblem(from, to);
  const params = {
    from,
    to,
    ...(siteId === 'all' ? {} : { siteId }),
    ...(stationId === 'all' ? {} : { stationId }),
  };

  const report = useQuery({
    queryKey: ['report', 'availability', from, to, siteId, stationId],
    queryFn: () => apiGet<AvailabilityReport>('/reports/availability', params),
    enabled: problem === null,
  });

  const csv = useMutation({
    mutationFn: () =>
      downloadCsv(
        '/reports/availability',
        params,
        `availability-${from}-to-${to}.csv`,
      ),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PeriodControls
        idPrefix="availability"
        from={from}
        to={to}
        siteId={siteId}
        onFrom={(value) => setPeriod((current) => ({ ...current, from: value }))}
        onTo={(value) => setPeriod((current) => ({ ...current, to: value }))}
        onSite={setSiteId}
      >
        <div className="space-y-1">
          <Label htmlFor="availability-station" className="text-xs">
            Charger
          </Label>
          <Select
            value={stationId}
            onValueChange={(value) => setStationId(value ?? 'all')}
          >
            <SelectTrigger id="availability-station" className="w-48">
              <SelectValue placeholder="Every charger" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Every charger</SelectItem>
              {(stations.data ?? []).map((station) => (
                <SelectItem key={station.id} value={station.id}>
                  {station.identity}
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
        <Empty>
          No connector reported a status in that period. Availability is
          recorded from the release that added connection history onwards.
        </Empty>
      ) : null}

      {report.isSuccess && report.data.rows.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Charger</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Connector</TableHead>
                  <TableHead className="text-right">Up</TableHead>
                  <TableHead className="text-right">Down</TableHead>
                  <TableHead className="text-right">Excluded</TableHead>
                  <TableHead className="text-right">Unknown</TableHead>
                  <TableHead className="text-right">Availability</TableHead>
                  <TableHead className="text-right">Coverage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.data.rows.map((row) => (
                  <TableRow
                    key={`${row.stationId}-${row.evse}-${row.connector}`}
                  >
                    <TableCell className="text-sm font-medium">
                      {row.stationIdentity}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.siteName ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.evse}/{row.connector}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {hours(row.upSeconds)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {hours(row.downSeconds)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {hours(row.excludedSeconds)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {hours(row.unknownSeconds)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {percent(row.availability)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {percent(row.coverage)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-muted-foreground mt-2 text-xs">
            Computed {dateTime(report.data.asOf)}. This operator counts
            Unavailable as {report.data.unavailableCountsAs}, which is a
            setting. Unknown is time a charger was not connected or had not
            reported a status, and is left out of availability.
          </p>
        </>
      ) : null}
    </>
  );
}
