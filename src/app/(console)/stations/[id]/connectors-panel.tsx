'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import { ConnectorBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet, apiSend } from '@/lib/api/client';
import type { Connector, Evse, Station } from '@/lib/api/types';
import { since } from '@/lib/format';

/**
 * What a charger's connectors are doing.
 *
 * A charger reports its status against an EVSE and connector number, and this
 * system keeps that status only against connectors somebody has added here.
 * Until they exist, a charger's reports are recorded as history but there is no
 * current state to show, which is why the empty case below says so rather than
 * looking like nothing is happening.
 */
export function ConnectorsPanel({ station }: { station: Station }) {
  const canAdmin = useCan('admin');

  const evses = useQuery({
    queryKey: ['station', station.id, 'evses'],
    queryFn: () => apiGet<Evse[]>(`/stations/${station.id}/evses`),
  });

  if (evses.isPending) return <Loading rows={3} />;
  if (evses.isError) return <Failed error={evses.error} />;

  return (
    <div className="space-y-4">
      {evses.data.length === 0 ? (
        <Empty>
          No connectors have been added for this charger yet, so the console has
          nowhere to record what it reports. Add an EVSE, then its connectors.
          {station.ocppVersion === '1.6'
            ? ' On OCPP 1.6 every connector belongs to EVSE 1.'
            : null}
        </Empty>
      ) : null}

      {evses.data.map((evse) => (
        <EvseCard
          key={evse.id}
          evse={evse}
          stationId={station.id}
          canAdmin={canAdmin}
        />
      ))}

      {canAdmin ? <AddEvse stationId={station.id} /> : null}
    </div>
  );
}

function EvseCard({
  evse,
  stationId,
  canAdmin,
}: {
  evse: Evse;
  stationId: string;
  canAdmin: boolean;
}) {
  const connectors = useQuery({
    queryKey: ['evse', evse.id, 'connectors'],
    queryFn: () => apiGet<Connector[]>(`/evses/${evse.id}/connectors`),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">EVSE {evse.evseNumber}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {connectors.isPending ? <Loading rows={1} /> : null}
        {connectors.isError ? <Failed error={connectors.error} /> : null}
        {connectors.isSuccess && connectors.data.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No connectors on this EVSE yet.
          </p>
        ) : null}

        {(connectors.data ?? []).map((connector) => (
          <div
            key={connector.id}
            className="flex flex-wrap items-center gap-3 border-b pb-3 last:border-0 last:pb-0"
          >
            <span className="font-medium">
              Connector {connector.connectorNumber}
            </span>
            <ConnectorBadge status={connector.status} />
            <span className="text-muted-foreground text-sm">
              {connector.connectorType ?? 'type not set'}
              {connector.maxAmperage ? ` · ${connector.maxAmperage} A` : ''}
            </span>
            <span className="text-muted-foreground ml-auto text-xs">
              {connector.statusUpdatedAt
                ? `changed ${since(connector.statusUpdatedAt)}`
                : 'never reported'}
            </span>
          </div>
        ))}

        {canAdmin ? (
          <AddConnector evseId={evse.id} stationId={stationId} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function AddEvse({ stationId }: { stationId: string }) {
  const [evseNumber, setEvseNumber] = useState('1');
  const queryClient = useQueryClient();

  const add = useMutation({
    mutationFn: () =>
      apiSend<Evse>('POST', `/stations/${stationId}/evses`, {
        evseNumber: Number(evseNumber),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['station', stationId, 'evses'],
      });
      toast.success('EVSE added');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        add.mutate();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="evseNumber" className="text-xs">
          Add an EVSE
        </Label>
        <Input
          id="evseNumber"
          type="number"
          min={1}
          max={1000}
          value={evseNumber}
          onChange={(event) => setEvseNumber(event.target.value)}
          className="w-28"
        />
      </div>
      <Button type="submit" variant="outline" disabled={add.isPending}>
        Add EVSE
      </Button>
    </form>
  );
}

function AddConnector({
  evseId,
  stationId,
}: {
  evseId: string;
  stationId: string;
}) {
  const [connectorNumber, setConnectorNumber] = useState('1');
  const [connectorType, setConnectorType] = useState('');
  const queryClient = useQueryClient();

  const add = useMutation({
    mutationFn: () =>
      apiSend<Connector>('POST', `/evses/${evseId}/connectors`, {
        connectorNumber: Number(connectorNumber),
        ...(connectorType.trim() ? { connectorType: connectorType.trim() } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['evse', evseId, 'connectors'],
      });
      void queryClient.invalidateQueries({ queryKey: ['station', stationId] });
      toast.success('Connector added');
      setConnectorType('');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="flex flex-wrap items-end gap-2 pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        add.mutate();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`connector-${evseId}`} className="text-xs">
          Number
        </Label>
        <Input
          id={`connector-${evseId}`}
          type="number"
          min={1}
          max={1000}
          value={connectorNumber}
          onChange={(event) => setConnectorNumber(event.target.value)}
          className="w-24"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`type-${evseId}`} className="text-xs">
          Type
        </Label>
        <Input
          id={`type-${evseId}`}
          value={connectorType}
          onChange={(event) => setConnectorType(event.target.value)}
          placeholder="cType2"
          className="w-36"
        />
      </div>
      <Button type="submit" variant="outline" disabled={add.isPending}>
        Add connector
      </Button>
    </form>
  );
}
