'use client';

import { StatementView } from '@/components/fleet/statement';
import { fleetApiGet } from '@/lib/api/fleet-client';
import type { FleetStatement } from '@/lib/api/fleet-types';

export function FleetStatementView() {
  return (
    <StatementView
      queryKey={['fleet', 'statement']}
      fetchStatement={(month) =>
        fleetApiGet<FleetStatement>('/fleet-manager/statement', { month })
      }
      csvHref={(month) => `/api/cvf/fleet-manager/statement?month=${month}&format=csv`}
    />
  );
}
