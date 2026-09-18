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
 * Since phase Q this list mostly fills itself: a charger reports its status
 * against an EVSE and connector number, and the platform creates whatever it
 * names. An OCPP 2.x charger goes further and is asked for its device model
 * after every boot, which is where connector types come from — no other message
 * carries one.
 *
 * So the things left for a person are the ones a charger cannot know: what the
 * socket is called on site, what plug a 1.6 charger has, and whether a socket is
 * still there. Adding one by hand still works, for a charger that has not
 * connected yet.
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
          Nothing here yet. Connectors appear on their own the first time this
          charger reports one, so this usually means it has not connected since
          it was added. You can add them by hand in the meantime.
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
          <ConnectorRow
            key={connector.id}
            connector={connector}
            evseId={evse.id}
            stationId={stationId}
            canAdmin={canAdmin}
          />
        ))}

        {canAdmin ? (
          <AddConnector evseId={evse.id} stationId={stationId} />
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * One connector, and the two things an operator can still say about it.
 *
 * Editing is behind a toggle rather than always on screen: most of the time this
 * is a status list being read, and a row of inputs per socket would bury the
 * thing people come here for.
 */
function ConnectorRow({
  connector,
  evseId,
  stationId,
  canAdmin,
}: {
  connector: Connector;
  evseId: string;
  stationId: string;
  canAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(connector.label ?? '');
  const [connectorType, setConnectorType] = useState(
    connector.connectorType ?? '',
  );
  const queryClient = useQueryClient();

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ['evse', evseId, 'connectors'],
    });
    void queryClient.invalidateQueries({ queryKey: ['station', stationId] });
  };

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiSend<Connector>('PATCH', `/connectors/${connector.id}`, body),
    onSuccess: (updated) => {
      refresh();
      setEditing(false);
      toast.success(
        updated.isRetired !== connector.isRetired
          ? updated.isRetired
            ? 'Connector retired'
            : 'Connector back in service'
          : 'Connector saved',
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-2 border-b pb-3 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={
            connector.isRetired ? 'text-muted-foreground font-medium' : 'font-medium'
          }
        >
          Connector {connector.connectorNumber}
        </span>
        {connector.label ? (
          <span className="text-sm">{connector.label}</span>
        ) : null}
        <ConnectorBadge status={connector.status} />
        {connector.isRetired ? (
          <span className="text-muted-foreground rounded border px-1.5 py-0.5 text-xs">
            retired
          </span>
        ) : null}
        <span className="text-muted-foreground text-sm">
          {connector.connectorType ?? 'type not set'}
          {connector.maxAmperage ? ` · ${connector.maxAmperage} A` : ''}
        </span>
        <span className="text-muted-foreground ml-auto text-xs">
          {connector.source === 'reported'
            ? 'reported by the charger'
            : 'added here'}
          {' · '}
          {connector.statusUpdatedAt
            ? `changed ${since(connector.statusUpdatedAt)}`
            : 'never reported'}
        </span>
        {canAdmin ? (
          <Button
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => setEditing((open) => !open)}
          >
            {editing ? 'Close' : 'Edit'}
          </Button>
        ) : null}
      </div>

      {editing ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({ label: label.trim(), connectorType: connectorType.trim() });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor={`label-${connector.id}`} className="text-xs">
              Name
            </Label>
            <Input
              id={`label-${connector.id}`}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="The one by the wall"
              maxLength={60}
              className="w-56"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`type-edit-${connector.id}`} className="text-xs">
              Type
            </Label>
            <Input
              id={`type-edit-${connector.id}`}
              value={connectorType}
              onChange={(event) => setConnectorType(event.target.value)}
              placeholder="cType2"
              maxLength={40}
              className="w-36"
            />
          </div>
          <Button type="submit" variant="outline" disabled={save.isPending}>
            Save
          </Button>
          <Button
            type="button"
            variant={connector.isRetired ? 'outline' : 'destructive'}
            disabled={save.isPending}
            onClick={() => save.mutate({ isRetired: !connector.isRetired })}
          >
            {connector.isRetired ? 'Put back in service' : 'Retire'}
          </Button>
          <p className="text-muted-foreground w-full text-xs">
            {connector.isRetired
              ? 'A retired connector stops following what the charger reports. Putting it back lets its status move again.'
              : 'Retiring keeps the row and its history, stops its status following the charger, and stops the charger re-creating it. There is no delete: the next report would simply add it back.'}
          </p>
        </form>
      ) : null}
    </div>
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
