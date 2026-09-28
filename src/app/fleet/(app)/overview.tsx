'use client';

import Link from 'next/link';
import { BillingMonthCard } from '@/components/fleet/billing-month';
import { useFleetManager } from '@/components/fleet-context';
import { PageHeader } from '@/components/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { fleetApiGet } from '@/lib/api/fleet-client';
import { billingModeLabel, type FleetBillingMonth } from '@/lib/api/fleet-types';

export function FleetOverview() {
  const { fleet } = useFleetManager();

  return (
    <>
      <PageHeader
        title={fleet.name}
        description={fleet.legalName ?? undefined}
      />
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Count href="/fleet/drivers" label="Drivers" value={fleet.memberCount} />
          <Count href="/fleet/vehicles" label="Vehicles" value={fleet.vehicleCount} />
          <Count href="/fleet/depots" label="Depots" value={fleet.depotCount} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How charging is paid for</CardTitle>
            <CardDescription>
              Set by your charging operator. Ask them to change it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">
              {billingModeLabel(fleet.billingMode, fleet.invoiceCollectsAtSession)}
            </p>
            <p className="text-muted-foreground">
              {fleet.billingMode === 'driver_pays'
                ? 'Your drivers pay for their own sessions from their wallet or card. The figures below are for your records.'
                : fleet.invoiceCollectsAtSession
                  ? 'Your drivers pay for each session, and you get a monthly statement of them.'
                  : 'Nothing is taken from your drivers at charge time. You are invoiced monthly for their sessions.'}
            </p>
          </CardContent>
        </Card>

        <BillingMonthCard
          queryKey={['fleet', 'billing']}
          fetchMonth={(month) =>
            fleetApiGet<FleetBillingMonth>('/fleet-manager/billing', { month })
          }
          owedLabel="You owe"
          statementHref={(month) => `/fleet/statement?month=${month}`}
        />
      </div>
    </>
  );
}

function Count({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link href={href}>
      <Card size="sm" className="hover:bg-muted/50 transition-colors">
        <CardContent className="space-y-1">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
