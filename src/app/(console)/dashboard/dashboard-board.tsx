'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DownloadIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  ChartCard,
  ColumnChart,
  HourWeekHeatmap,
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
  ratio,
} from '@/components/dashboard/format';
import { ChargingNowCard, KpiCard } from '@/components/dashboard/kpi-card';
import { PeriodFilter } from '@/components/dashboard/period-filter';
import { PageHeader } from '@/components/page-header';
import { Empty, Failed } from '@/components/query-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiGet } from '@/lib/api/client';
import type {
  Dashboard,
  DashboardGroup,
  PaymentMethod,
  Site,
  StartMethod,
  Station,
} from '@/lib/api/types';
import { dateTime, energy, money } from '@/lib/format';
import {
  bucketLabel,
  bucketTitle,
  periodLabel,
  periodProblem,
  presetPeriod,
} from '@/lib/period';
import { downloadCsv } from '../reports/period';

type Metric = 'sessions' | 'energy' | 'revenue';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  free: 'Free charging (sponsored)',
  wallet: 'Driver wallet',
  online: 'Online card payment',
  not_collected: 'Not collected in the app',
};

const START_LABELS: Record<StartMethod, string> = {
  app: 'Driver app',
  card: 'Registered card',
  unregistered: 'Unknown card',
  none: 'No card',
};

/**
 * The console's overview (`charveta` doc 6 §20.4): what the network did over
 * a period, against the period of the same length before it.
 *
 * One request for the whole screen: the API reads the sessions once and hands
 * back every figure and breakdown, with the same definitions as the session
 * report — same sessions, same local days, revenue as receipts less credit
 * notes, one currency at a time. The charts only draw what came back.
 */
export function DashboardBoard() {
  // Lazily, because today is read from the clock and a render must not.
  const [period, setPeriod] = useState(() => presetPeriod('30d'));
  const [siteId, setSiteId] = useState('all');
  const [stationId, setStationId] = useState('all');
  const [metric, setMetric] = useState<Metric>('sessions');
  const [chosenCurrency, setCurrency] = useState<string | null>(null);

  const { from, to } = period;
  const problem = periodProblem(from, to);
  const params = {
    from,
    to,
    ...(siteId === 'all' ? {} : { siteId }),
    ...(stationId === 'all' ? {} : { stationId }),
  };

  const sites = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiGet<Site[]>('/locations'),
  });
  const stations = useQuery({
    queryKey: ['stations'],
    queryFn: () => apiGet<Station[]>('/stations'),
  });
  const dashboard = useQuery({
    queryKey: ['dashboard', from, to, siteId, stationId],
    queryFn: () => apiGet<Dashboard>('/reports/dashboard', params),
    enabled: problem === null,
    // Keep the last figures on screen while a new period loads, rather than
    // flashing the whole page back to skeletons on every filter change.
    placeholderData: keepPreviousData,
  });

  const csv = useMutation({
    mutationFn: (table: 'series' | 'sites' | 'stations') =>
      downloadCsv(
        '/reports/dashboard',
        { ...params, table },
        `dashboard-${table}-${from}-to-${to}.csv`,
      ),
    onError: (error: Error) => toast.error(error.message),
  });

  const siteStations = (stations.data ?? []).filter(
    (station) => siteId === 'all' || station.locationId === siteId,
  );
  const data = dashboard.data;
  const currencies = data?.kpis.revenue.map((r) => r.currency) ?? [];
  const currency =
    chosenCurrency && currencies.includes(chosenCurrency)
      ? chosenCurrency
      : (currencies[0] ?? null);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Sessions, energy, revenue and availability over a period, against the period of the same length just before it."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <PeriodFilter idPrefix="dash" period={period} onChange={setPeriod} />

        <div className="space-y-1">
          <Label htmlFor="dash-site" className="text-xs">
            Site
          </Label>
          <Select
            value={siteId}
            onValueChange={(value) => {
              setSiteId(value ?? 'all');
              setStationId('all');
            }}
          >
            <SelectTrigger id="dash-site" className="w-48">
              <SelectValue>
                {(value: string) =>
                  value === 'all'
                    ? 'Every site'
                    : (sites.data?.find((s) => s.id === value)?.name ?? 'Site')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Every site</SelectItem>
              {(sites.data ?? []).map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="dash-station" className="text-xs">
            Charger
          </Label>
          <Select
            value={stationId}
            onValueChange={(value) => setStationId(value ?? 'all')}
          >
            <SelectTrigger id="dash-station" className="w-48">
              <SelectValue>
                {(value: string) =>
                  value === 'all'
                    ? 'Every charger'
                    : (stations.data?.find((s) => s.id === value)?.identity ??
                      'Charger')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Every charger</SelectItem>
              {siteStations.map((station) => (
                <SelectItem key={station.id} value={station.id}>
                  {station.identity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {problem ? (
        <Alert className="mb-4">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      ) : null}
      {dashboard.isError ? <Failed error={dashboard.error} /> : null}
      {dashboard.isPending && problem === null ? <DashboardSkeleton /> : null}

      {data ? (
        <div
          className="space-y-6 transition-opacity data-[stale=true]:opacity-60"
          data-stale={dashboard.isFetching && dashboard.isPlaceholderData}
        >
          <p className="text-muted-foreground text-xs">
            {periodLabel(data.from, data.to)}, compared with{' '}
            {periodLabel(data.previousFrom, data.previousTo)}. Dates are each
            site’s own.
          </p>

          <div className="stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
            <ChargingNowCard count={data.kpis.activeNow} />
            <KpiCard label="Sessions" kpi={data.kpis.sessions} format={count} />
            <KpiCard label="Energy" kpi={data.kpis.energyWh} format={kwh} />
            {data.kpis.revenue.length === 0 ? (
              <KpiCard
                label="Net revenue"
                kpi={{ current: null, previous: null, changePct: null }}
                format={() => '—'}
                hint="No receipts in either period"
              />
            ) : (
              data.kpis.revenue.map((r) => (
                <KpiCard
                  key={r.currency}
                  label={`Net revenue (${r.currency})`}
                  kpi={r.netMinor}
                  format={inCurrency(r.currency)}
                  hint={`Gross ${money(r.grossMinor.current ?? '0', r.currency)} with tax`}
                />
              ))
            )}
          </div>

          <section aria-labelledby="kpi-use" className="space-y-2">
            <h2 id="kpi-use" className="heading text-sm">
              How your network is used
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <KpiCard
                compact
                label="Average session"
                kpi={data.kpis.averageDurationMinutes}
                format={minutes}
                better="neutral"
              />
              <KpiCard
                compact
                label="Average energy per session"
                kpi={data.kpis.averageEnergyWh}
                format={kwh}
                better="neutral"
              />
              <KpiCard
                compact
                label="Drivers"
                kpi={data.kpis.uniqueDrivers}
                format={count}
                hint={`${count(data.kpis.uniqueIdTokens.current)} distinct cards and app tokens`}
              />
              <KpiCard
                compact
                label="Availability"
                kpi={data.kpis.availability}
                format={ratio}
                hint={`Seen ${ratio(data.kpis.coverage.current)} of connector time`}
              />
              <KpiCard
                compact
                label="Utilisation"
                kpi={data.kpis.utilisation}
                format={ratio}
                hint="Session time ÷ connector up time"
              />
            </div>
          </section>

          <section aria-labelledby="kpi-attention" className="space-y-2">
            <h2 id="kpi-attention" className="heading text-sm">
              Needs a look
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <KpiCard
                compact
                label="Unpriced sessions"
                kpi={data.kpis.unpricedSessions}
                format={count}
                better="down"
                href={`/sessions?flagged=true&from=${data.from}&to=${data.to}`}
              />
              <KpiCard
                compact
                label="Billed on our clock"
                kpi={data.kpis.untrustedClockSessions}
                format={count}
                better="down"
                hint="The charger’s clock was not trusted"
                href={`/sessions?flagged=true&from=${data.from}&to=${data.to}`}
              />
              <KpiCard
                compact
                label="Refused card taps"
                kpi={data.kpis.refusedAuthorizations}
                format={count}
                better="down"
                href="/cards/reads"
              />
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Segmented<Metric>
              label="What the charts show"
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'sessions', label: 'Sessions' },
                { value: 'energy', label: 'Energy' },
                { value: 'revenue', label: 'Net revenue' },
              ]}
            />
            {metric === 'revenue' && currencies.length > 1 ? (
              <Segmented<string>
                label="Currency"
                value={currency ?? ''}
                onChange={setCurrency}
                options={currencies.map((c) => ({ value: c, label: c }))}
              />
            ) : null}
            {metric === 'revenue' && currency === null ? (
              <span className="text-muted-foreground text-xs">
                No revenue in this period.
              </span>
            ) : null}
          </div>

          {data.kpis.sessions.current === '0' ? (
            <Empty>
              No sessions closed in this period. Late events can still add some
              — the figures are as of {dateTime(data.asOf)}.
            </Empty>
          ) : (
            <>
              <ChartCard
                title={`${METRIC_TITLES[metric]} by ${data.bucket === 'hour' ? 'hour' : 'day'}`}
                description={
                  metric === 'revenue' && currency
                    ? `Receipts less credit notes, before tax, in ${currency}.`
                    : undefined
                }
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
                <ChartCard title={`${METRIC_TITLES[metric]} by site`}>
                  <RankedBars
                    rows={data.bySite.map((g) =>
                      ranked(g, metric, currency, g.label ?? 'No site'),
                    )}
                  />
                </ChartCard>
                <ChartCard title={`Top chargers by ${METRIC_TITLES[metric].toLowerCase()}`}>
                  <RankedBars
                    rows={data.byStation.map((g) => ({
                      ...ranked(g, metric, currency, g.label ?? g.key),
                      sub: g.siteName ?? undefined,
                    }))}
                  />
                </ChartCard>
              </div>

              <ChartCard
                title="When chargers are busy"
                description="Sessions by the hour they started and the day of the week."
              >
                <HourWeekHeatmap cells={data.heatmap} />
              </ChartCard>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="How sessions were paid"
                  description="From what settlement recorded; fleet-invoiced and plain card sessions are “not collected in the app”."
                >
                  <RankedBars
                    color="var(--chart-2)"
                    rows={data.byPaymentMethod.map((g) =>
                      ranked(
                        g,
                        metric,
                        currency,
                        PAYMENT_LABELS[g.key as PaymentMethod] ?? g.key,
                      ),
                    )}
                  />
                </ChartCard>
                <ChartCard
                  title="How sessions were started"
                  description="From the card or token each session started with."
                >
                  <RankedBars
                    color="var(--chart-3)"
                    rows={data.byStartMethod.map((g) =>
                      ranked(
                        g,
                        metric,
                        currency,
                        START_LABELS[g.key as StartMethod] ?? g.key,
                      ),
                    )}
                  />
                </ChartCard>
              </div>

              <ChartCard
                title="The rows behind it"
                actions={
                  <div className="flex flex-wrap gap-2">
                    {(['series', 'sites', 'stations'] as const).map((table) => (
                      <Button
                        key={table}
                        variant="outline"
                        size="sm"
                        disabled={csv.isPending}
                        onClick={() => csv.mutate(table)}
                      >
                        <DownloadIcon />
                        {table === 'series'
                          ? 'By day CSV'
                          : table === 'sites'
                            ? 'Sites CSV'
                            : 'Chargers CSV'}
                      </Button>
                    ))}
                  </div>
                }
              >
                <Tabs defaultValue="sites">
                  <TabsList>
                    <TabsTrigger value="sites">Sites</TabsTrigger>
                    <TabsTrigger value="stations">Chargers</TabsTrigger>
                  </TabsList>
                  <TabsContent value="sites" className="pt-3">
                    <GroupTable
                      groups={data.bySite}
                      name="Site"
                      nameOf={(g) => g.label ?? 'No site'}
                    />
                  </TabsContent>
                  <TabsContent value="stations" className="pt-3">
                    <GroupTable
                      groups={data.byStation}
                      name="Charger"
                      nameOf={(g) => g.label ?? g.key}
                      subOf={(g) => g.siteName}
                    />
                  </TabsContent>
                </Tabs>
              </ChartCard>
            </>
          )}

          <p className="text-muted-foreground text-xs">
            Computed {dateTime(data.asOf)}. Late events change days that have
            already passed, so the same period can read differently later.
          </p>
        </div>
      ) : null}
    </>
  );
}

const METRIC_TITLES: Record<Metric, string> = {
  sessions: 'Sessions',
  energy: 'Energy',
  revenue: 'Net revenue',
};

function netIn(group: DashboardGroup, currency: string | null) {
  return group.revenue.find((m) => m.currency === currency)?.netMinor;
}

function value(group: DashboardGroup, metric: Metric, currency: string | null): number {
  if (metric === 'sessions') return group.sessions;
  if (metric === 'energy') return kwhNumber(group.energyWh);
  return majorNumber(netIn(group, currency));
}

function display(group: DashboardGroup, metric: Metric, currency: string | null): string {
  if (metric === 'sessions') {
    return `${group.sessions} session${group.sessions === 1 ? '' : 's'}`;
  }
  if (metric === 'energy') return energy(group.energyWh);
  return currency ? money(netIn(group, currency) ?? '0', currency) : '—';
}

function ranked(
  group: DashboardGroup,
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

function GroupTable({
  groups,
  name,
  nameOf,
  subOf,
}: {
  groups: DashboardGroup[];
  name: string;
  nameOf: (group: DashboardGroup) => string;
  subOf?: (group: DashboardGroup) => string | null;
}) {
  return (
    <div className="bg-card overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{name}</TableHead>
            <TableHead className="text-right">Sessions</TableHead>
            <TableHead className="text-right">Energy</TableHead>
            <TableHead className="text-right">Billed time</TableHead>
            <TableHead className="text-right">Net revenue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <TableRow key={group.key}>
              <TableCell className="text-sm">
                {nameOf(group)}
                {subOf?.(group) ? (
                  <span className="text-muted-foreground block text-xs">
                    {subOf(group)}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {group.sessions}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {energy(group.energyWh)}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {minutes(group.billedMinutes)}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {group.revenue.length === 0
                  ? '—'
                  : group.revenue.map((m) => (
                      <span key={m.currency} className="block">
                        {money(m.netMinor, m.currency)}
                      </span>
                    ))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
