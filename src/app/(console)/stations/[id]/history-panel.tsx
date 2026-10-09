'use client';

import { FilterCombobox } from '@/components/filter-combobox';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Empty, Failed, Loading } from '@/components/query-state';
import { ConnectorBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
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
import type {
  BootEntry,
  ComponentEventEntry,
  ConnectionEntry,
  ConnectorStatusEntry,
} from '@/lib/api/types';
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
        <TabsTrigger value="connections">Connections</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
        <TabsTrigger value="device-events">Device events</TabsTrigger>
      </TabsList>

      <TabsContent value="status" className="pt-4">
        <ConnectorStatusHistory stationId={stationId} />
      </TabsContent>
      <TabsContent value="boots" className="pt-4">
        <Boots stationId={stationId} />
      </TabsContent>
      <TabsContent value="connections" className="pt-4">
        <Connections stationId={stationId} />
      </TabsContent>
      <TabsContent value="reports" className="pt-4">
        <Reports stationId={stationId} />
      </TabsContent>
      <TabsContent value="device-events" className="pt-4">
        <DeviceEvents stationId={stationId} />
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
    <div className="bg-card overflow-x-auto rounded-xl border">
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
    <div className="bg-card overflow-x-auto rounded-xl border">
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

/**
 * When the charger connected and dropped off, and where each connection came
 * from (doc 6 §17.13): its own address, and the trusted proxy it came through
 * if any. Informational only — nothing decides anything from the address —
 * and cleared by the API after its address retention; the rows stay.
 */
function Connections({ stationId }: { stationId: string }) {
  const connections = useQuery({
    queryKey: ['station', stationId, 'connections'],
    queryFn: () =>
      apiGet<ConnectionEntry[]>(`/stations/${stationId}/connections`),
  });

  if (connections.isPending) return <Loading rows={4} />;
  if (connections.isError) return <Failed error={connections.error} />;
  if (connections.data.length === 0) {
    return <Empty>This charger has not connected yet.</Empty>;
  }

  return (
    <div className="bg-card overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>From</TableHead>
            <TableHead>Via</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {connections.data.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-sm whitespace-nowrap">
                {dateTime(entry.receivedAt)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={entry.kind === 'connected' ? 'secondary' : 'outline'}
                >
                  {entry.kind === 'connected' ? 'Connected' : 'Disconnected'}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {entry.kind === 'connected' ? (entry.address ?? '—') : ''}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {entry.via ?? ''}
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
      <FilterCombobox
        value={kind}
        onChange={setKind}
        items={REPORT_KINDS}
        label="Report kind"
        className="w-full sm:w-60"
      />

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

/**
 * What an OCPP 2.x charger's device model reported about itself — `NotifyEvent`
 * (`charveta` doc 6 §13): where a 2.x charger says *why* it faulted, since 2.x
 * dropped the fault fields from its connector status. A 1.6 charger has none.
 *
 * Each event names the monitor that fired it by the charger's id; where the
 * station's monitor list (the Monitoring tab) knows that monitor, its rule is
 * shown beside the event.
 */
function DeviceEvents({ stationId }: { stationId: string }) {
  const [openOnly, setOpenOnly] = useState('all');

  const events = useQuery({
    queryKey: ['station', stationId, 'component-events', openOnly],
    queryFn: () =>
      apiGet<ComponentEventEntry[]>(
        `/stations/${stationId}/component-events`,
        openOnly === 'open' ? { open: 'true' } : undefined,
      ),
  });

  return (
    <div className="space-y-3">
      <FilterCombobox
        value={openOnly}
        onChange={setOpenOnly}
        items={[
          { value: 'all', label: 'Every event' },
          { value: 'open', label: 'What is wrong now' },
        ]}
        label="Events"
        className="w-full sm:w-60"
      />

      {events.isPending ? <Loading rows={4} /> : null}
      {events.isError ? <Failed error={events.error} /> : null}
      {events.isSuccess && events.data.length === 0 ? (
        <Empty>
          {openOnly === 'open'
            ? 'Nothing is currently alerting.'
            : 'The charger has not reported a device event. OCPP 1.6 chargers never do.'}
        </Empty>
      ) : null}

      {events.isSuccess && events.data.length > 0 ? (
        <div className="bg-card overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Where</TableHead>
                <TableHead>Variable</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Monitor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.data.map((entry, index) => (
                <TableRow key={`${entry.receivedAt}-${entry.stationEventId}-${index}`}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {dateTime(entry.occurredAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.evseNumber === 0
                      ? 'Station'
                      : entry.connectorNumber === 0
                        ? `EVSE ${entry.evseNumber}`
                        : `EVSE ${entry.evseNumber} · connector ${entry.connectorNumber}`}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {entry.componentName}
                    {entry.componentInstance ? `[${entry.componentInstance}]` : ''}.
                    {entry.variableName}
                    {entry.variableInstance ? `[${entry.variableInstance}]` : ''}
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.actualValue}
                    {entry.techCode ? (
                      <p className="text-muted-foreground text-xs">
                        {entry.techCode}
                        {entry.techInfo ? ` — ${entry.techInfo}` : ''}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        entry.trigger === 'Alerting' && !entry.cleared
                          ? 'destructive'
                          : 'outline'
                      }
                    >
                      {entry.trigger}
                      {entry.cleared ? ' · cleared' : ''}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.monitor ? (
                      <span
                        title={`Severity ${entry.monitor.severity}; ${
                          entry.monitor.origin === 'csms'
                            ? 'set here'
                            : 'the charger’s own'
                        }`}
                      >
                        #{entry.monitor.monitorId} · {entry.monitor.type}{' '}
                        {entry.monitor.value}
                      </span>
                    ) : entry.variableMonitoringId !== null ? (
                      <span className="text-muted-foreground">
                        #{entry.variableMonitoringId}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {entry.notificationType === 'HardWiredNotification'
                          ? 'built in'
                          : '—'}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
