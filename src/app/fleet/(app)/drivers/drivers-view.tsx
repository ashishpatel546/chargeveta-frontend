'use client';

import { useQuery } from '@tanstack/react-query';
import { MembersTable } from '@/components/fleet/members-table';
import { PageHeader } from '@/components/page-header';
import { Empty, Failed, Loading } from '@/components/query-state';
import { fleetApiGet } from '@/lib/api/fleet-client';
import type { FleetMember } from '@/lib/api/fleet-types';

export function FleetDriversView() {
  const members = useQuery({
    queryKey: ['fleet', 'members'],
    queryFn: () => fleetApiGet<FleetMember[]>('/fleet-manager/members'),
  });

  return (
    <>
      <PageHeader
        title="Drivers"
        description="Your fleet's drivers and the cards they charge with. Your charging operator adds and removes drivers."
      />
      {members.isPending ? <Loading /> : null}
      {members.isError ? <Failed error={members.error} /> : null}
      {members.isSuccess && members.data.length === 0 ? (
        <Empty>No drivers yet. Ask your charging operator to add them.</Empty>
      ) : null}
      {members.isSuccess && members.data.length > 0 ? (
        <MembersTable members={members.data} />
      ) : null}
    </>
  );
}
