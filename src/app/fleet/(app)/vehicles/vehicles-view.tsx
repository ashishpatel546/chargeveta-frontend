'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { VehicleDialog, VehiclesTable } from '@/components/fleet/vehicles';
import { PageHeader } from '@/components/page-header';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { fleetApiGet, fleetApiSend } from '@/lib/api/fleet-client';
import type { FleetMember, Vehicle, VehicleInput } from '@/lib/api/fleet-types';

export function FleetVehiclesView() {
  const queryClient = useQueryClient();
  const vehicles = useQuery({
    queryKey: ['fleet', 'vehicles'],
    queryFn: () => fleetApiGet<Vehicle[]>('/fleet-manager/vehicles'),
  });
  const members = useQuery({
    queryKey: ['fleet', 'members'],
    queryFn: () => fleetApiGet<FleetMember[]>('/fleet-manager/members'),
  });

  async function save(path: string, method: 'POST' | 'PATCH', input: VehicleInput) {
    try {
      await fleetApiSend<Vehicle>(method, path, input);
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    }
    toast.success(method === 'POST' ? 'Vehicle added.' : 'Vehicle saved.');
    await queryClient.invalidateQueries({ queryKey: ['fleet', 'vehicles'] });
  }

  const memberList = members.data ?? [];

  return (
    <>
      <PageHeader
        title="Vehicles"
        description="A record of your vehicles and who drives them. Charging still starts with the driver's own card."
      >
        <VehicleDialog
          members={memberList}
          onSave={(input) => save('/fleet-manager/vehicles', 'POST', input)}
          trigger={<Button />}
          triggerLabel="Add vehicle"
        />
      </PageHeader>
      {vehicles.isPending ? <Loading /> : null}
      {vehicles.isError ? <Failed error={vehicles.error} /> : null}
      {vehicles.isSuccess && vehicles.data.length === 0 ? (
        <Empty>No vehicles yet.</Empty>
      ) : null}
      {vehicles.isSuccess && vehicles.data.length > 0 ? (
        <VehiclesTable
          vehicles={vehicles.data}
          members={memberList}
          actions={(vehicle) => (
            <VehicleDialog
              vehicle={vehicle}
              members={memberList}
              onSave={(input) =>
                save(`/fleet-manager/vehicles/${vehicle.id}`, 'PATCH', input)
              }
              trigger={<Button variant="outline" size="sm" />}
              triggerLabel="Change"
            />
          )}
        />
      ) : null}
    </>
  );
}
