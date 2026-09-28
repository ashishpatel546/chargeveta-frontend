'use client';

import { FleetSessionsTable } from '@/components/fleet/sessions-table';
import { PageHeader } from '@/components/page-header';
import { fleetApiGet } from '@/lib/api/fleet-client';
import type { FleetSessionPage } from '@/lib/api/fleet-types';

export function FleetSessionsView() {
  return (
    <>
      <PageHeader
        title="Sessions"
        description="Your drivers' charging sessions, newest first, from the day each joined your fleet."
      />
      <FleetSessionsTable
        queryKey={['fleet', 'sessions']}
        fetchPage={(cursor) =>
          fleetApiGet<FleetSessionPage>('/fleet-manager/sessions', { cursor })
        }
      />
    </>
  );
}
