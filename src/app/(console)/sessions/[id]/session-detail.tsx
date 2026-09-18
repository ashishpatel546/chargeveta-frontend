'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
import { Failed, Loading } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { apiGet } from '@/lib/api/client';
import type { Station, Transaction } from '@/lib/api/types';
import { dateTime, energy, span } from '@/lib/format';
import { IssueReceiptButton, StopSessionButton } from './session-actions';
import { SessionCostPanel } from './session-cost-panel';
import { SessionEvents } from './session-events';
import { SessionReadings } from './session-readings';

export function SessionDetail({ id }: { id: string }) {
  const canOperate = useCan('operator');
  const canAdmin = useCan('admin');

  // Under `['transactions', …]` so the realtime provider's invalidation of a
  // session event refreshes this screen the way it refreshes the list.
  const session = useQuery({
    queryKey: ['transactions', id],
    queryFn: () => apiGet<Transaction>(`/transactions/${id}`),
  });

  const stationId = session.data?.stationId;
  const station = useQuery({
    queryKey: ['station', stationId],
    queryFn: () => apiGet<Station>(`/stations/${stationId}`),
    enabled: stationId !== undefined,
  });

  if (session.isPending) return <Loading />;
  if (session.isError) return <Failed error={session.error} />;

  const it = session.data;
  const chargerName = station.data?.identity ?? 'this charger';

  return (
    <>
      <PageHeader
        title={it.transactionRef}
        description={`OCPP ${it.protocolVersion} · started ${dateTime(it.startedAt)}`}
      >
        {canAdmin ? <IssueReceiptButton id={id} /> : null}
        {canOperate && it.isOpen ? <StopSessionButton id={id} /> : null}
      </PageHeader>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Session
              {it.isOpen ? (
                <Badge
                  variant="outline"
                  className="border-sky-600/30 bg-sky-600/10 font-medium text-sky-700 dark:text-sky-400"
                >
                  running
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Charger">
                <Link
                  href={`/stations/${it.stationId}`}
                  className="hover:underline"
                >
                  {chargerName}
                </Link>
              </Field>
              <Field label="Card">{it.idToken ?? '—'}</Field>
              <Field label="Started">{dateTime(it.startedAt)}</Field>
              <Field label="Stopped">
                {it.stoppedAt ? dateTime(it.stoppedAt) : 'still running'}
              </Field>
              <Field label="Duration">{span(it.startedAt, it.stoppedAt)}</Field>
              <Field label="Energy">{energy(it.energyWh)}</Field>
              <Field label="Meter start">
                {it.meterStart === undefined ? '—' : `${it.meterStart} Wh`}
              </Field>
              <Field label="Meter stop">
                {it.meterStop === undefined ? '—' : `${it.meterStop} Wh`}
              </Field>
              <Field label="Stop reason">{it.stoppedReason ?? '—'}</Field>
              <Field label="Protocol">OCPP {it.protocolVersion}</Field>
              <Field label="EVSE">{it.evseId ?? '—'}</Field>
              <Field label="Connector">{it.connectorId ?? '—'}</Field>
            </dl>
          </CardContent>
        </Card>

        <SessionCostPanel id={id} />

        <Tabs defaultValue="events">
          <TabsList>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="readings">Meter readings</TabsTrigger>
          </TabsList>
          <TabsContent value="events">
            <SessionEvents id={id} />
          </TabsContent>
          <TabsContent value="readings">
            <SessionReadings id={id} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
