'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DownloadIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  ChartCard,
  ColumnChart,
  RankedBars,
  Segmented,
  type RankedDatum,
} from '@/components/dashboard/charts';
import {
  compact,
  count,
  inCurrency,
  kwh,
  kwhNumber,
  majorNumber,
  minutes,
  perKwh,
} from '@/components/dashboard/format';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { PeriodFilter } from '@/components/dashboard/period-filter';
import { Empty, Failed } from '@/components/query-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  Depot,
  FleetDashboard,
  FleetDashboardGroup,
  FleetMember,
} from '@/lib/api/fleet-types';
import { dateTime, energy, money } from '@/lib/format';
import {
  bucketLabel,
  bucketTitle,
  periodLabel,
  periodProblem,
  presetPeriod,
} from '@/lib/period';

type Metric = 'sessions' | 'energy' | 'cost';

export type FleetDashboardTable = 'series' | 'drivers' | 'sites';

/**
 * A fleet's dashboard (`charveta` doc 6 §23): its members' charging and what
 * it cost over a period, against the period before it. The fleet portal's
 * overview shows it for the manager's own fleet, and staff see any fleet's
 * on its page — one component, two routes, the same response.
 *
 * Cost is what the monthly bill totals (`fleet_charges`), so a calendar month
 * here reads the same as that month's bill. Sessions record no vehicle; a
 * driver's row names the vehicles assigned to them now, as context only.
 */
export function FleetDashboardPanel({
  queryKey,
  fetchDashboard,
  fetchMembers,
  fetchDepots,
  downloadCsv,
  owedLabel = 'Owed by the fleet',
}: {
  queryKey: readonly unknown[];
  fetchDashboard: (
    params: Record<string, string | undefined>,
  ) => Promise<FleetDashboard>;
  fetchMembers: () => Promise<FleetMember[]>;
  fetchDepots: () => Promise<Depot[]>;
  downloadCsv: (
    params: Record<string, string | undefined>,
    table: FleetDashboardTable,
  ) => Promise<void>;
  owedLabel?: string;
}) {
  const [period, setPeriod] = useState(() => presetPeriod('this-month'));
  const [siteId, setSiteId] = useState('all');
  const [driverId, setDriverId] = useState('all');
  const [metric, setMetric] = useState<Metric>('energy');
  const [chosenCurrency, setCurrency] = useState<string | null>(null);

  const { from, to } = period;
  const problem = periodProblem(from, to);
  const params = {
    from,
    to,
    ...(siteId === 'all' ? {} : { siteId }),
    ...(driverId === 'all' ? {} : { driverId }),
  };

  const members = useQuery({
    queryKey: [...queryKey, 'members'],
    queryFn: fetchMembers,
  });
  const depots = useQuery({
    queryKey: [...queryKey, 'depots'],
    queryFn: fetchDepots,
  });
  const dashboard = useQuery({
    queryKey: [...queryKey, 'dashboard', from, to, siteId, driverId],
    queryFn: () => fetchDashboard(params),
    enabled: problem === null,
    placeholderData: keepPreviousData,
  });
  const csv = useMutation({
    mutationFn: (table: FleetDashboardTable) => downloadCsv(params, table),
    onError: (error: Error) => toast.error(error.message),
  });

  const data = dashboard.data;
  const currencies = data?.kpis.cost.map((c) => c.currency) ?? [];
  const currency =
    chosenCurrency && currencies.includes(chosenCurrency)
      ? chosenCurrency
      : (currencies[0] ?? null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <PeriodFilter idPrefix="fleet-dash" period={period} onChange={setPeriod} />
        <div className="space-y-1">
          <Label htmlFor="fleet-dash-site" className="text-xs">
            Depot
          </Label>
          <Select value={siteId} onValueChange={(value) => setSiteId(value ?? 'all')}>
            <SelectTrigger id="fleet-dash-site" className="w-48">
              <SelectValue>
                {(value: string) =>
                  value === 'all'
                    ? 'Anywhere'
                    : (depots.data?.find((d) => d.locationId === value)?.name ??
                      'Depot')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anywhere</SelectItem>
              {(depots.data ?? []).map((depot) => (
                <SelectItem key={depot.locationId} value={depot.locationId}>
                  {depot.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="fleet-dash-driver" className="text-xs">
            Driver
          </Label>
          <Select
            value={driverId}
            onValueChange={(value) => setDriverId(value ?? 'all')}
          >
            <SelectTrigger id="fleet-dash-driver" className="w-48">
              <SelectValue>
                {(value: string) =>
                  value === 'all'
                    ? 'Every driver'
                    : memberName(members.data?.find((m) => m.driverId === value))
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Every driver</SelectItem>
              {(members.data ?? []).map((member) => (
                <SelectItem key={member.driverId} value={member.driverId}>
                  {memberName(member)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {problem ? (
        <Alert>
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      ) : null}
      {dashboard.isError ? <Failed error={dashboard.error} /> : null}
      {dashboard.isPending && problem === null ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-busy>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : null}

      {data ? (
        <div
          className="space-y-6 transition-opacity data-[stale=true]:opacity-60"
          data-stale={dashboard.isFetching && dashboard.isPlaceholderData}
        >
          <p className="text-muted-foreground text-xs">
            {periodLabel(data.from, data.to)}, compared with{' '}
            {periodLabel(data.previousFrom, data.previousTo)}. A session’s day
            is its start at its site, as on the monthly bill.
          </p>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <KpiCard label="Sessions" kpi={data.kpis.sessions} format={count} />
            <KpiCard label="Energy" kpi={data.kpis.energyWh} format={kwh} />
            {data.kpis.cost.map((c) => (
              <KpiCard
                key={`cost-${c.currency}`}
                label={`Cost (${c.currency})`}
                kpi={c.totalMinor}
                format={inCurrency(c.currency)}
                better="neutral"
                hint={`${owedLabel}: ${money(c.owedMinor.current ?? '0', c.currency)} · paid by drivers: ${money(c.collectedMinor.current ?? '0', c.currency)}`}
              />
            ))}
            {data.kpis.cost.map((c) => (
              <KpiCard
                key={`kwh-${c.currency}`}
                label={`Cost per kWh (${c.currency})`}
                kpi={c.perKwhMinor}
                format={perKwh(c.currency)}
                better="down"
              />
            ))}
            <KpiCard
              label="Average session"
              kpi={data.kpis.averageDurationMinutes}
              format={minutes}
              better="neutral"
            />
            <KpiCard
              label="Average energy per session"
              kpi={data.kpis.averageEnergyWh}
              format={kwh}
              better="neutral"
            />
            <KpiCard
              label="Drivers charging"
              kpi={data.kpis.activeDrivers}
              format={count}
              better="neutral"
            />
            <KpiCard
              label="Not billed yet"
              kpi={data.kpis.unbilledSessions}
              format={count}
              better="down"
              hint="Unpriced, or not settled yet"
            />
            <Card size="sm">
              <CardContent className="space-y-1">
                <p className="text-muted-foreground text-xs">Charging now</p>
                <p className="text-2xl font-semibold tracking-tight">
                  {data.kpis.activeNow}
                </p>
              </CardContent>
            </Card>
          </div>

          {data.kpis.sessions.current === '0' ? (
            <Empty>No sessions by your drivers closed in this period.</Empty>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Segmented<Metric>
                  label="What the charts show"
                  value={metric}
                  onChange={setMetric}
                  options={[
                    { value: 'energy', label: 'Energy' },
                    { value: 'sessions', label: 'Sessions' },
                    { value: 'cost', label: 'Cost' },
                  ]}
                />
                {metric === 'cost' && currencies.length > 1 ? (
                  <Segmented<string>
                    label="Currency"
                    value={currency ?? ''}
                    onChange={setCurrency}
                    options={currencies.map((c) => ({ value: c, label: c }))}
                  />
                ) : null}
              </div>

              <ChartCard
                title={`${TITLES[metric]} by ${data.bucket === 'hour' ? 'hour' : 'day'}`}
              >
                <ColumnChart
                  data={data.series.map((g) => ({
                    key: g.key,
                    tick: bucketLabel(g.key, data.bucket),
                    title: bucketTitle(g.key, data.bucket),
                    value: value(g, metric, currency),
                    display: display(g, metric, currency),
                  }))}
                  formatAxis={compact}
                />
              </ChartCard>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard title={`Top drivers by ${TITLES[metric].toLowerCase()}`}>
                  <RankedBars
                    rows={data.byDriver.map((g) => ({
                      ...ranked(g, metric, currency, g.label ?? 'Driver'),
                      sub: g.vehicles?.join(', ') || undefined,
                    }))}
                  />
                </ChartCard>
                <ChartCard title={`${TITLES[metric]} by site`}>
                  <RankedBars
                    color="var(--chart-2)"
                    rows={data.bySite.map((g) => ({
                      ...ranked(g, metric, currency, g.label ?? 'No site'),
                      sub: g.isDepot ? 'depot' : undefined,
                    }))}
                  />
                </ChartCard>
              </div>

              <ChartCard
                title="By driver"
                description="Vehicles are those assigned to each driver now; sessions do not record which vehicle charged."
                actions={
                  <div className="flex flex-wrap gap-2">
                    {(['drivers', 'sites', 'series'] as const).map((table) => (
                      <Button
                        key={table}
                        variant="outline"
                        size="sm"
                        disabled={csv.isPending}
                        onClick={() => csv.mutate(table)}
                      >
                        <DownloadIcon />
                        {table === 'drivers'
                          ? 'Drivers CSV'
                          : table === 'sites'
                            ? 'Sites CSV'
                            : 'By day CSV'}
                      </Button>
                    ))}
                  </div>
                }
              >
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Driver</TableHead>
                        <TableHead className="text-right">Sessions</TableHead>
                        <TableHead className="text-right">Energy</TableHead>
                        <TableHead className="text-right">Time</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byDriver.map((g) => (
                        <TableRow key={g.key}>
                          <TableCell className="text-sm">
                            {g.label ?? '—'}
                            {g.vehicles && g.vehicles.length > 0 ? (
                              <span className="mt-0.5 flex flex-wrap gap-1">
                                {g.vehicles.map((reg) => (
                                  <Badge key={reg} variant="outline">
                                    {reg}
                                  </Badge>
                                ))}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {g.sessions}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {energy(g.energyWh)}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {minutes(g.minutes)}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {g.cost.length === 0
                              ? '—'
                              : g.cost.map((c) => (
                                  <span key={c.currency} className="block">
                                    {money(c.totalMinor, c.currency)}
                                  </span>
                                ))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ChartCard>
            </>
          )}

          <p className="text-muted-foreground text-xs">
            Computed {dateTime(data.asOf)}. A session is costed when it is
            settled, so the latest days can still change.
          </p>
        </div>
      ) : null}
    </div>
  );
}

const TITLES: Record<Metric, string> = {
  sessions: 'Sessions',
  energy: 'Energy',
  cost: 'Cost',
};

function memberName(member: FleetMember | undefined): string {
  if (!member) return 'Driver';
  return member.name ?? member.phone ?? member.email ?? 'Driver';
}

function costIn(group: FleetDashboardGroup, currency: string | null) {
  return group.cost.find((c) => c.currency === currency)?.totalMinor;
}

function value(
  group: FleetDashboardGroup,
  metric: Metric,
  currency: string | null,
): number {
  if (metric === 'sessions') return group.sessions;
  if (metric === 'energy') return kwhNumber(group.energyWh);
  return majorNumber(costIn(group, currency));
}

function display(
  group: FleetDashboardGroup,
  metric: Metric,
  currency: string | null,
): string {
  if (metric === 'sessions') {
    return `${group.sessions} session${group.sessions === 1 ? '' : 's'}`;
  }
  if (metric === 'energy') return energy(group.energyWh);
  return currency ? money(costIn(group, currency) ?? '0', currency) : '—';
}

function ranked(
  group: FleetDashboardGroup,
  metric: Metric,
  currency: string | null,
  label: string,
): RankedDatum {
  return {
    key: group.key,
    label,
    value: value(group, metric, currency),
    display: display(group, metric, currency),
  };
}
