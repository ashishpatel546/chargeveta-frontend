'use client';

import { useQuery } from '@tanstack/react-query';
import { DepotsTable } from '@/components/fleet/depots-table';
import { PageHeader } from '@/components/page-header';
import { Empty, Failed, Loading } from '@/components/query-state';
import { fleetApiGet } from '@/lib/api/fleet-client';
import type { Depot } from '@/lib/api/fleet-types';

export function FleetDepotsView() {
  const depots = useQuery({
    queryKey: ['fleet', 'depots'],
    queryFn: () => fleetApiGet<Depot[]>('/fleet-manager/depots'),
  });

  return (
    <>
      <PageHeader
        title="Depots"
        description="Charging sites recorded as your fleet's. Your charging operator records them."
      />
      {depots.isPending ? <Loading /> : null}
      {depots.isError ? <Failed error={depots.error} /> : null}
      {depots.isSuccess && depots.data.length === 0 ? (
        <Empty>No depots recorded.</Empty>
      ) : null}
      {depots.isSuccess && depots.data.length > 0 ? (
        <DepotsTable depots={depots.data} />
      ) : null}
    </>
  );
}
