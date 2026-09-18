'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Empty, Failed, Loading } from '@/components/query-state';
import { ConnectorBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiGet } from '@/lib/api/client';
import type { BootEntry, ConnectorStatusEntry } from '@/lib/api/types';
import { dateTime } from '@/lib/format';

/**
 * What the charger has told us.
 *
 * All of this is written by the event worker rather than on the charger's
 * connection, so it arrives a moment after the charger said it — and if the
 * worker is not running, it does not arrive at all. An empty history on a
 * charger that is plainly connected means that, and it is worth knowing before
 * anyone goes looking for a fault in the charger.
 */
export function HistoryPanel({ stationId }: { stationId: string }) {
  return (
    <Tabs defaultValue="status">
      <TabsList>
        <TabsTrigger value="status">Connector status</TabsTrigger>
        <TabsTrigger value="boots">Boots</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
      </TabsList>

      <TabsContent value="status" className="pt-4">
        <ConnectorStatusHistory stationId={stationId} />
      </TabsContent>
      <TabsContent value="boots" className="pt-4">
        <Boots stationId={stationId} />
      </TabsContent>
      <TabsContent value="reports" className="pt-4">
        <Reports stationId={stationId} />
      </TabsContent>
    </Tabs>
  );
}

function ConnectorStatusHistory({ stationId }: { stationId: string }) {
  const history = useQuery({
    queryKey: ['station', stationId, 'connector-status'],
    queryFn: () =>
      apiGet<ConnectorStatusEntry[]>(
        `/stations/${stationId}/connector-status`,
      ),
  });

  if (history.isPending) return <Loading rows={4} />;
  if (history.isError) return <Failed error={history.error} />;
  if (history.data.length === 0) {
    return <Empty>The charger has not reported a connector status yet.</Empty>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Connector</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reported as</TableHead>
            <TableHead>Fault</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.data.map((entry, index) => (
            <TableRow key={`${entry.receivedAt}-${index}`}>
              <TableCell className="text-sm whitespace-nowrap">
                {dateTime(entry.occurredAt ?? entry.receivedAt)}
              </TableCell>
              <TableCell className="text-sm">
                EVSE {entry.evseNumber} · connector {entry.connectorNumber}
              </TableCell>
              <TableCell>
                <ConnectorBadge status={entry.status} />
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {entry.reportedStatus}
              </TableCell>
              <TableCell className="text-sm">
                {entry.errorCode && entry.errorCode !== 'NoError' ? (
                  <span className="text-destructive">
                    {entry.errorCode}
                    {entry.vendorErrorCode ? ` (${entry.vendorErrorCode})` : ''}
                  </span>
                ) : (
                  '—'
                )}
                {entry.info ? (
                  <p className="text-muted-foreground text-xs">{entry.info}</p>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Boots({ stationId }: { stationId: string }) {
  const boots = useQuery({
    queryKey: ['station', stationId, 'boots'],
    queryFn: () => apiGet<BootEntry[]>(`/stations/${stationId}/boots`),
  });

  if (boots.isPending) return <Loading rows={4} />;
  if (boots.isError) return <Failed error={boots.error} />;
  if (boots.data.length === 0) {
    return <Empty>This charger has not connected yet.</Empty>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Answer</TableHead>
            <TableHead>Reported as</TableHead>
            <TableHead>Firmware</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="text-right">Heartbeat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {boots.data.map((entry, index) => (
            <TableRow key={`${entry.receivedAt}-${index}`}>
              <TableCell className="text-sm whitespace-nowrap">
                {dateTime(entry.occurredAt ?? entry.receivedAt)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    entry.status === 'Accepted' ? 'secondary' : 'destructive'
                  }
                >
                  {entry.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {entry.reportedVendor} {entry.reportedModel}
                {entry.reportedSerialNumber ? (
                  <p className="text-muted-foreground text-xs">
                    {entry.reportedSerialNumber}
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="text-sm">
                {entry.reportedFirmwareVersion ?? '—'}
              </TableCell>
              <TableCell className="text-sm">
                {entry.bootReason ?? '—'}
              </TableCell>
              <TableCell className="text-right text-sm">
                {entry.intervalSeconds}s
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const REPORT_KINDS = [
  { value: 'all', label: 'Every kind' },
  { value: 'firmware', label: 'Firmware' },
  { value: 'diagnostics', label: 'Diagnostics' },
  { value: 'security', label: 'Security' },
  { value: 'data-transfer', label: 'Data transfer' },
  { value: 'certificate-request', label: 'Certificate requests' },
];

interface ReportEntry {
  id: string;
  kind: string;
  source: string;
  status?: string;
  requestId?: number;
  detail: Record<string, unknown>;
  protocolVersion: string;
  occurredAt?: string;
  receivedAt: string;
}

function Reports({ stationId }: { stationId: string }) {
  const [kind, setKind] = useState('all');

  const reports = useQuery({
    queryKey: ['station', stationId, 'reports', kind],
    queryFn: () =>
      apiGet<ReportEntry[]>(
        `/stations/${stationId}/reports`,
        kind === 'all' ? undefined : { kind },
      ),
  });

  return (
    <div className="space-y-3">
      <Select value={kind} onValueChange={(value) => setKind(value ?? 'all')}>
        <SelectTrigger className="w-60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REPORT_KINDS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {reports.isPending ? <Loading rows={4} /> : null}
      {reports.isError ? <Failed error={reports.error} /> : null}
      {reports.isSuccess && reports.data.length === 0 ? (
        <Empty>Nothing of that kind has been reported.</Empty>
      ) : null}

      {reports.isSuccess && reports.data.length > 0 ? (
        <div className="space-y-2">
          {reports.data.map((entry) => (
            <details key={entry.id} className="rounded-md border p-3">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">{entry.kind}</Badge>
                <span className="font-medium">{entry.status ?? entry.source}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {dateTime(entry.occurredAt ?? entry.receivedAt)}
                </span>
              </summary>
              <pre className="bg-muted mt-2 max-h-80 overflow-auto rounded p-2 font-mono text-xs">
                {JSON.stringify(entry.detail, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}
