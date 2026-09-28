'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../_shared/confirm-dialog';
import { VehicleDialog, VehiclesTable } from '@/components/fleet/vehicles';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { apiGet, apiSend } from '@/lib/api/client';
import type { FleetMember, Vehicle, VehicleInput } from '@/lib/api/fleet-types';

export function VehiclesTab({ fleetId }: { fleetId: string }) {
  const canAdmin = useCan('admin');
  const queryClient = useQueryClient();
  const vehicles = useQuery({
    queryKey: ['fleet', fleetId, 'vehicles'],
    queryFn: () => apiGet<Vehicle[]>(`/fleets/${fleetId}/vehicles`),
  });
  const members = useQuery({
    queryKey: ['fleet', fleetId, 'members'],
    queryFn: () => apiGet<FleetMember[]>(`/fleets/${fleetId}/members`),
  });
  const memberList = members.data ?? [];

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['fleet', fleetId] }),
      queryClient.invalidateQueries({ queryKey: ['fleets'] }),
    ]);

  async function send(
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    input?: VehicleInput,
  ) {
    try {
      await apiSend<Vehicle>(method, path, input);
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    }
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Tracking records only: charging still starts with the driver&apos;s
          own card. The fleet&apos;s managers can add and change these too.
        </p>
        {canAdmin ? (
          <VehicleDialog
            members={memberList}
            onSave={(input) => send('POST', `/fleets/${fleetId}/vehicles`, input)}
            trigger={<Button />}
            triggerLabel="Add vehicle"
          />
        ) : null}
      </div>
      {vehicles.isPending ? <Loading /> : null}
      {vehicles.isError ? <Failed error={vehicles.error} /> : null}
      {vehicles.isSuccess && vehicles.data.length === 0 ? (
        <Empty>No vehicles yet.</Empty>
      ) : null}
      {vehicles.isSuccess && vehicles.data.length > 0 ? (
        <VehiclesTable
          vehicles={vehicles.data}
          members={memberList}
          actions={
            canAdmin
              ? (vehicle) => (
                  <div className="flex justify-end gap-2">
                    <VehicleDialog
                      vehicle={vehicle}
                      members={memberList}
                      onSave={(input) =>
                        send('PATCH', `/fleets/${fleetId}/vehicles/${vehicle.id}`, input)
                      }
                      trigger={<Button variant="outline" size="sm" />}
                      triggerLabel="Change"
                    />
                    <ConfirmDialog
                      trigger={<Button variant="outline" size="sm" />}
                      triggerLabel="Delete"
                      title={`Delete ${vehicle.registration}?`}
                      description="The record goes for good. To keep it but show it out of service, change it instead."
                      confirmLabel="Delete"
                      onConfirm={() =>
                        send('DELETE', `/fleets/${fleetId}/vehicles/${vehicle.id}`)
                      }
                    />
                  </div>
                )
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
