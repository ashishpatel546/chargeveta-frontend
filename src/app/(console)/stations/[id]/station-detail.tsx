'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { CommandsPanel } from './commands-panel';
import { ConnectorsPanel } from './connectors-panel';
import { HistoryPanel } from './history-panel';
import { StationSettingsPanel } from './station-settings-panel';
import { PageHeader } from '@/components/page-header';
import { Failed, Loading } from '@/components/query-state';
import { LiveBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiGet } from '@/lib/api/client';
import type { Site, Station } from '@/lib/api/types';
import { dateTime, since } from '@/lib/format';

export function StationDetail({ stationId }: { stationId: string }) {
  const station = useQuery({
    queryKey: ['station', stationId],
    queryFn: () => apiGet<Station>(`/stations/${stationId}`),
  });

  const sites = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiGet<Site[]>('/locations'),
  });

  if (station.isPending) return <Loading rows={8} />;
  if (station.isError) return <Failed error={station.error} />;

  const site = (sites.data ?? []).find(
    (candidate) => candidate.id === station.data.locationId,
  );

  return (
    <>
      <PageHeader
        title={station.data.identity}
        description={
          [station.data.vendor, station.data.model, station.data.serialNumber]
            .filter(Boolean)
            .join(' · ') || 'No vendor or model reported yet.'
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <LiveBadge lastSeenAt={station.data.lastSeenAt} />
          {station.data.quarantinedAt ? (
            <Badge variant="destructive">quarantined</Badge>
          ) : null}
          {!station.data.isActive ? (
            <Badge variant="outline">disabled</Badge>
          ) : null}
        </div>
      </PageHeader>

      <dl className="mb-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <Fact label="OCPP">{station.data.ocppVersion}</Fact>
        <Fact label="Site">
          {site ? (
            <Link href="/sites" className="hover:underline">
              {site.name}
            </Link>
          ) : (
            '—'
          )}
        </Fact>
        <Fact label="Last heard from">
          <span title={dateTime(station.data.lastSeenAt)}>
            {since(station.data.lastSeenAt)}
          </span>
        </Fact>
        <Fact label="Firmware">{station.data.firmwareVersion ?? '—'}</Fact>
      </dl>

      {station.data.quarantinedAt ? (
        <p className="border-destructive text-destructive mb-6 rounded-md border-l-2 bg-red-500/5 p-3 text-sm">
          This charger is quarantined: the system refuses its connection and
          drops anything it sends.{' '}
          {station.data.quarantineReason
            ? `Reason given: ${station.data.quarantineReason}.`
            : 'No reason was recorded.'}
        </p>
      ) : null}

      <Tabs defaultValue="connectors">
        <TabsList>
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
          <TabsTrigger value="commands">Commands</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="connectors" className="pt-4">
          <ConnectorsPanel station={station.data} />
        </TabsContent>
        <TabsContent value="commands" className="pt-4">
          <CommandsPanel station={station.data} />
        </TabsContent>
        <TabsContent value="history" className="pt-4">
          <HistoryPanel stationId={stationId} />
        </TabsContent>
        <TabsContent value="settings" className="pt-4">
          <StationSettingsPanel station={station.data} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
