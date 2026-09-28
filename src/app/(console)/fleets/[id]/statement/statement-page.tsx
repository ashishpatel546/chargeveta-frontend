'use client';

import Link from 'next/link';
import { StatementView } from '@/components/fleet/statement';
import { useCan } from '@/components/principal-context';
import { apiGet, apiSend } from '@/lib/api/client';
import type { FleetStatement } from '@/lib/api/fleet-types';

export function FleetStatementPage({ id }: { id: string }) {
  const canAdmin = useCan('admin');
  return (
    <div className="space-y-4">
      <Link
        href={`/fleets/${id}`}
        className="text-muted-foreground text-sm underline-offset-4 hover:underline print:hidden"
      >
        ← Back to the fleet
      </Link>
      <StatementView
        queryKey={['fleet', id, 'statement']}
        fetchStatement={(month) =>
          apiGet<FleetStatement>(`/fleets/${id}/statement`, { month })
        }
        csvHref={(month) => `/api/cv/fleets/${id}/statement?month=${month}&format=csv`}
        sendStatement={
          canAdmin
            ? (month) =>
                apiSend<{ recipients: string[]; emailEnabled: boolean }>(
                  'POST',
                  `/fleets/${id}/statement/send`,
                  { month },
                )
            : undefined
        }
      />
    </div>
  );
}
