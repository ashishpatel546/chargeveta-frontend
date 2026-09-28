'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../_shared/confirm-dialog';
import { DepotsTable } from '@/components/fleet/depots-table';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet, apiSend } from '@/lib/api/client';
import type { Depot } from '@/lib/api/fleet-types';
import type { Site } from '@/lib/api/types';

export function DepotsTab({ fleetId }: { fleetId: string }) {
  const canAdmin = useCan('admin');
  const queryClient = useQueryClient();
  const [siteId, setSiteId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const depots = useQuery({
    queryKey: ['fleet', fleetId, 'depots'],
    queryFn: () => apiGet<Depot[]>(`/fleets/${fleetId}/depots`),
  });
  const sites = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiGet<Site[]>('/locations'),
    enabled: canAdmin,
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['fleet', fleetId] }),
      queryClient.invalidateQueries({ queryKey: ['fleets'] }),
    ]);

  async function send(method: 'PUT' | 'DELETE', locationId: string) {
    setPending(true);
    try {
      await apiSend<unknown>(method, `/fleets/${fleetId}/depots/${locationId}`);
      toast.success(method === 'PUT' ? 'Depot recorded.' : 'Depot removed.');
      setSiteId(null);
      await refresh();
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    } finally {
      setPending(false);
    }
  }

  const recorded = new Set(depots.data?.map((d) => d.locationId) ?? []);
  const choosable = (sites.data ?? []).filter((site) => !recorded.has(site.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          A site recorded as this fleet&apos;s depot. Recorded only: other
          cards can still charge there. A site is at most one fleet&apos;s
          depot.
        </p>
        {canAdmin ? (
          <div className="flex gap-2">
            <Select
              value={siteId}
              onValueChange={setSiteId}
              items={choosable.map((site) => ({ value: site.id, label: site.name }))}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Choose a site" />
              </SelectTrigger>
              <SelectContent>
                {choosable.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!siteId || pending}
              onClick={() => siteId && void send('PUT', siteId).catch(() => undefined)}
            >
              Record depot
            </Button>
          </div>
        ) : null}
      </div>
      {depots.isPending ? <Loading /> : null}
      {depots.isError ? <Failed error={depots.error} /> : null}
      {depots.isSuccess && depots.data.length === 0 ? (
        <Empty>No depots recorded.</Empty>
      ) : null}
      {depots.isSuccess && depots.data.length > 0 ? (
        <DepotsTable
          depots={depots.data}
          actions={
            canAdmin
              ? (depot) => (
                  <ConfirmDialog
                    trigger={<Button variant="outline" size="sm" />}
                    triggerLabel="Remove"
                    title={`Stop recording ${depot.name} as a depot?`}
                    description="The site itself is unchanged; it is only no longer recorded as this fleet's."
                    confirmLabel="Remove"
                    pending={pending}
                    onConfirm={() => send('DELETE', depot.locationId)}
                  />
                )
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
