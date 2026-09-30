'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FleetDialog, type FleetInput } from '../fleet-dialog';
import { DepotsTab } from './depots-tab';
import { ManagersTab } from './managers-tab';
import { MembersTab } from './members-tab';
import { VehiclesTab } from './vehicles-tab';
import { ActiveBadge } from '@/components/fleet/billing-badge';
import { BillingMonthCard } from '@/components/fleet/billing-month';
import { FleetDashboardPanel } from '@/components/fleet/fleet-dashboard';
import { FleetSessionsTable } from '@/components/fleet/sessions-table';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
import { Failed, Loading } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiGet, apiSend } from '@/lib/api/client';
import {
  billingModeLabel,
  type Depot,
  type Fleet,
  type FleetDashboard,
  type FleetMember,
  type FleetBillingMonth,
  type FleetSessionPage,
} from '@/lib/api/fleet-types';
import { downloadCsvVia } from '@/lib/download';
import { date } from '@/lib/format';

/** One fleet, for staff (doc 6 §23): who is in it, what it owns, who manages it, and its bill. */
export function FleetDetail({ id }: { id: string }) {
  const canAdmin = useCan('admin');
  const queryClient = useQueryClient();

  const fleet = useQuery({
    queryKey: ['fleet', id],
    queryFn: () => apiGet<Fleet>(`/fleets/${id}`),
  });

  async function update(input: FleetInput) {
    try {
      await apiSend<Fleet>('PATCH', `/fleets/${id}`, input);
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    }
    toast.success('Fleet saved.');
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['fleet', id] }),
      queryClient.invalidateQueries({ queryKey: ['fleets'] }),
    ]);
  }

  if (fleet.isPending) return <Loading />;
  if (fleet.isError) return <Failed error={fleet.error} />;
  const data = fleet.data;

  return (
    <>
      <PageHeader title={data.name} description={data.legalName ?? undefined}>
        {canAdmin ? (
          <FleetDialog
            fleet={data}
            onSave={update}
            trigger={<Button variant="outline" />}
            triggerLabel="Change"
          />
        ) : null}
      </PageHeader>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="drivers">Drivers ({data.memberCount})</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles ({data.vehicleCount})</TabsTrigger>
          <TabsTrigger value="depots">Depots ({data.depotCount})</TabsTrigger>
          <TabsTrigger value="managers">Managers</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Details <ActiveBadge active={data.isActive} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <Field label="Who pays">
                  {billingModeLabel(data.billingMode, data.invoiceCollectsAtSession)}
                </Field>
                <Field label="GSTIN">{data.gstin ?? '—'}</Field>
                <Field label="Billing email">{data.billingEmail ?? '—'}</Field>
                <Field label="Added">{date(data.createdAt)}</Field>
              </dl>
            </CardContent>
          </Card>
          <BillingMonthCard
            queryKey={['fleet', id, 'billing']}
            fetchMonth={(month) =>
              apiGet<FleetBillingMonth>(`/fleets/${id}/billing`, { month })
            }
            statementHref={(month) => `/fleets/${id}/statement?month=${month}`}
          />
        </TabsContent>

        <TabsContent value="dashboard" className="pt-4">
          {/* What the fleet's managers see on their own overview, from the
              same API function; mounted only while the tab is open. */}
          <FleetDashboardPanel
            queryKey={['fleet', id]}
            fetchDashboard={(params) =>
              apiGet<FleetDashboard>(`/fleets/${id}/dashboard`, params)
            }
            fetchMembers={() => apiGet<FleetMember[]>(`/fleets/${id}/members`)}
            fetchDepots={() => apiGet<Depot[]>(`/fleets/${id}/depots`)}
            downloadCsv={(params, table) =>
              downloadCsvVia(
                '/api/cv',
                `/fleets/${id}/dashboard`,
                { ...params, table },
                `fleet-dashboard-${table}.csv`,
              )
            }
          />
        </TabsContent>

        <TabsContent value="drivers" className="pt-4">
          <MembersTab fleetId={id} />
        </TabsContent>
        <TabsContent value="vehicles" className="pt-4">
          <VehiclesTab fleetId={id} />
        </TabsContent>
        <TabsContent value="depots" className="pt-4">
          <DepotsTab fleetId={id} />
        </TabsContent>
        <TabsContent value="managers" className="pt-4">
          <ManagersTab fleetId={id} />
        </TabsContent>
        <TabsContent value="sessions" className="pt-4">
          <FleetSessionsTable
            queryKey={['fleet', id, 'sessions']}
            fetchPage={(cursor) =>
              apiGet<FleetSessionPage>(`/fleets/${id}/sessions`, { cursor })
            }
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
