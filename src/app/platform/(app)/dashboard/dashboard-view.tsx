'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  DownloadIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ChartCard,
  ColumnChart,
  RankedBars,
  Segmented,
} from '@/components/dashboard/charts';
import {
  compact,
  count,
  inCurrency,
  kwh,
  kwhNumber,
  majorNumber,
} from '@/components/dashboard/format';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { PeriodFilter } from '@/components/dashboard/period-filter';
import { PageHeader } from '@/components/page-header';
import { Empty, Failed } from '@/components/query-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { platformApiGet } from '@/lib/api/platform-client';
import type {
  PlatformDashboard,
  PlatformDashboardTenant,
} from '@/lib/api/platform-types';
import { downloadCsvVia } from '@/lib/download';
import { dateTime, energy, money } from '@/lib/format';
import {
  bucketLabel,
  bucketTitle,
  periodLabel,
  periodProblem,
  presetPeriod,
} from '@/lib/period';

type Metric = 'sessions' | 'energy';
type SortKey = 'revenue' | 'sessions' | 'energy';

/**
 * The platform console's landing page (`charveta` doc 6 §19.5): every
 * operator's totals over a period, against the period of the same length
 * before it, and the platform's.
 *
 * Totals only — the API sends no driver, card, session, charger or site, so
 * there is nothing here to drill into, by design: a platform admin who needs
 * a tenant's detail is not the person who should see it. Every load (and
 * every CSV) is a row in the platform audit log, and the page says so.
 *
 * Money is per currency throughout, as the API sends it; nothing here adds
 * two currencies, or does arithmetic on a figure it would send back.
 */
export function PlatformDashboardView() {
  // Lazily, because today is read from the clock and a render must not.
  const [period, setPeriod] = useState(() => presetPeriod('30d'));
  const [metric, setMetric] = useState<Metric>('sessions');
  const [chosenCurrency, setCurrency] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('revenue');

  const { from, to } = period;
  const problem = periodProblem(from, to);

  const dashboard = useQuery({
    queryKey: ['platform', 'dashboard', from, to],
    queryFn: () =>
      platformApiGet<PlatformDashboard>(
        `/dashboard?${new URLSearchParams({ from, to }).toString()}`,
      ),
    enabled: problem === null,
    // Keep the last figures on screen while a new period loads.
    placeholderData: keepPreviousData,
    // Each load is an audited read; refetching on every window focus would
    // fill the audit log with views nobody made.
    refetchOnWindowFocus: false,
  });

  const csv = useMutation({
    mutationFn: () =>
      downloadCsvVia(
        '/api/cvp',
        '/dashboard',
        { from, to },
        `platform-tenants-${from}-to-${to}.csv`,
      ),
    onError: (error: Error) => toast.error(error.message),
  });

  const data = dashboard.data;
  const currencies = data?.totals.revenue.map((r) => r.currency) ?? [];
  const currency =
    chosenCurrency && currencies.includes(chosenCurrency)
      ? chosenCurrency
      : (currencies[0] ?? null);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Every operator’s sessions, energy and revenue over a period, against the period of the same length just before it."
      />

      <p className="text-muted-foreground mb-4 flex items-start gap-1.5 text-xs">
        <ShieldCheckIcon className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>
          Totals only; each view is recorded in the platform audit log.
        </span>
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <PeriodFilter idPrefix="pdash" period={period} onChange={setPeriod} />
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
          className="min-w-0 space-y-6 transition-opacity data-[stale=true]:opacity-60"
          data-stale={dashboard.isFetching && dashboard.isPlaceholderData}
        >
          <p className="text-muted-foreground text-xs">
            {periodLabel(data.from, data.to)}, compared with{' '}
            {periodLabel(data.previousFrom, data.previousTo)}. Dates are each
            site’s own.
          </p>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <KpiCard label="Sessions" kpi={data.totals.sessions} format={count} />
            <KpiCard label="Energy" kpi={data.totals.energyWh} format={kwh} />
            {data.totals.revenue.length === 0 ? (
              <KpiCard
                label="Net revenue"
                kpi={{ current: null, previous: null, changePct: null }}
                format={() => '—'}
                hint="No receipts in either period"
              />
            ) : (
              data.totals.revenue.map((r) => (
                <KpiCard
                  key={r.currency}
                  label={`Net revenue (${r.currency})`}
                  kpi={r.netMinor}
                  format={inCurrency(r.currency)}
                  hint="Receipts less credit notes, before tax"
                />
              ))
            )}
            <NowCard
              label="Operators"
              value={data.totals.tenants}
              hint={`${count(String(data.totals.activeTenants))} active, ${count(
                String(data.totals.tenants - data.totals.activeTenants),
              )} suspended`}
            />
            <NowCard
              label="Chargers online now"
              value={data.totals.onlineStations}
              hint={`of ${count(String(data.totals.activeStations))} switched on`}
            />
            <NowCard
              label="Charging now"
              value={data.totals.chargingNow}
              hint="Open sessions, whatever the period"
            />
            <NowCard
              label="Drivers"
              value={data.totals.activeDrivers}
              hint="Active driver accounts, now"
            />
          </div>

          {data.totals.sessions.current === '0' ? (
            <Empty>
              No sessions closed in this period on any operator. Late events
              can still add some — the figures are as of {dateTime(data.asOf)}.
            </Empty>
          ) : (
            <div className="grid min-w-0 gap-6 lg:grid-cols-2">
              <ChartCard
                title={`${metric === 'sessions' ? 'Sessions' : 'Energy'} by ${data.bucket === 'hour' ? 'hour' : 'day'}`}
                description="Across every operator."
                actions={
                  <Segmented<Metric>
                    label="What the chart shows"
                    value={metric}
                    onChange={setMetric}
                    options={[
                      { value: 'sessions', label: 'Sessions' },
                      { value: 'energy', label: 'Energy' },
                    ]}
                  />
                }
              >
                <ColumnChart
                  data={data.series.map((point) => ({
                    key: point.key,
                    tick: bucketLabel(point.key, data.bucket),
                    title: bucketTitle(point.key, data.bucket),
                    value:
                      metric === 'sessions'
                        ? point.sessions
                        : kwhNumber(point.energyWh),
                    display:
                      metric === 'sessions'
                        ? `${point.sessions} session${point.sessions === 1 ? '' : 's'}`
                        : energy(point.energyWh),
                  }))}
                  formatAxis={compact}
                />
              </ChartCard>

              <ChartCard
                title="Net revenue by operator"
                description={
                  currency
                    ? `Receipts less credit notes, before tax, in ${currency}.`
                    : 'No revenue in this period.'
                }
                actions={
                  currencies.length > 1 ? (
                    <Segmented<string>
                      label="Currency"
                      value={currency ?? ''}
                      onChange={setCurrency}
                      options={currencies.map((c) => ({ value: c, label: c }))}
                    />
                  ) : null
                }
              >
                <RankedBars
                  color="var(--chart-2)"
                  rows={
                    currency
                      ? data.tenants.map((t) => {
                          const net = netIn(t, currency);
                          return {
                            key: t.id,
                            label: t.name,
                            sub: t.isActive ? undefined : 'suspended',
                            value: majorNumber(net ?? undefined),
                            display: money(net ?? '0', currency),
                          };
                        })
                      : []
                  }
                  empty="No revenue in this period."
                />
              </ChartCard>
            </div>
          )}

          <ChartCard
            title="Operators"
            description="Each operator’s own totals. Suspended operators are included: their sessions still happened."
            actions={
              <Button
                variant="outline"
                size="sm"
                disabled={csv.isPending}
                onClick={() => csv.mutate()}
              >
                <DownloadIcon />
                CSV
              </Button>
            }
          >
            <TenantTable
              tenants={data.tenants}
              sort={sort}
              onSort={setSort}
              currency={currency}
            />
          </ChartCard>

          <p className="text-muted-foreground text-xs">
            Computed {dateTime(data.asOf)}. Late events change days that have
            already passed, so the same period can read differently later.
          </p>
        </div>
      ) : null}
    </>
  );
}

function NowCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">
          {value.toLocaleString('en-IN')}
        </p>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </CardContent>
    </Card>
  );
}

function netIn(
  tenant: PlatformDashboardTenant,
  currency: string | null,
): string | null {
  return (
    tenant.revenue.find((r) => r.currency === currency)?.netMinor.current ??
    null
  );
}

/** Decimal strings compared as numbers, for ordering only. */
function sortValue(
  tenant: PlatformDashboardTenant,
  key: SortKey,
  currency: string | null,
): number {
  if (key === 'sessions') return Number(tenant.sessions.current ?? 0);
  if (key === 'energy') return Number(tenant.energyWh.current ?? 0);
  return Number(netIn(tenant, currency) ?? 0);
}

const SORT_LABELS: Record<SortKey, string> = {
  revenue: 'Net revenue',
  sessions: 'Sessions',
  energy: 'Energy',
};

/**
 * Every operator, largest first by the chosen column (revenue in the
 * currency picked above). Scrolls inside its card at phone width, never the
 * page.
 */
function TenantTable({
  tenants,
  sort,
  onSort,
  currency,
}: {
  tenants: PlatformDashboardTenant[];
  sort: SortKey;
  onSort: (key: SortKey) => void;
  currency: string | null;
}) {
  const rows = [...tenants].sort(
    (a, b) =>
      sortValue(b, sort, currency) - sortValue(a, sort, currency) ||
      a.name.localeCompare(b.name),
  );

  const sortable = (key: SortKey) => (
    <TableHead
      className="text-right"
      aria-sort={sort === key ? 'descending' : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(key)}
        className="hover:text-foreground inline-flex items-center gap-1"
      >
        {SORT_LABELS[key]}
        {key === 'revenue' && currency ? ` (${currency})` : ''}
        {sort === key ? (
          <ArrowDownIcon className="size-3.5" aria-hidden />
        ) : (
          <ArrowUpDownIcon className="text-muted-foreground size-3.5" aria-hidden />
        )}
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-3">
      <div className="sm:hidden">
        <Segmented<SortKey>
          label="Sort operators by"
          value={sort}
          onChange={onSort}
          options={(['revenue', 'sessions', 'energy'] as const).map((key) => ({
            value: key,
            label: SORT_LABELS[key],
          }))}
        />
      </div>
      <div className="bg-card overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operator</TableHead>
              {sortable('sessions')}
              {sortable('energy')}
              {sortable('revenue')}
              <TableHead className="text-right">Chargers online</TableHead>
              <TableHead className="text-right">Charging now</TableHead>
              <TableHead className="text-right">Drivers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className="text-sm">
                  <span className="font-medium">{tenant.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {tenant.slug}
                    {tenant.enabledModules.length > 0
                      ? ` · ${tenant.enabledModules.join(', ')}`
                      : ''}
                  </span>
                  {tenant.isActive ? null : (
                    <Badge variant="outline" className="mt-1">
                      suspended
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {count(tenant.sessions.current)}
                  <Was value={count(tenant.sessions.previous)} />
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {kwh(tenant.energyWh.current)}
                  <Was value={kwh(tenant.energyWh.previous)} />
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {tenant.revenue.length === 0
                    ? '—'
                    : tenant.revenue.map((r) => (
                        <span key={r.currency} className="block">
                          {money(r.netMinor.current ?? '0', r.currency)}
                          <Was
                            value={money(r.netMinor.previous ?? '0', r.currency)}
                          />
                        </span>
                      ))}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {tenant.onlineStations}
                  <span className="text-muted-foreground">
                    {' '}
                    / {tenant.activeStations}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {tenant.chargingNow}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {tenant.activeDrivers}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** The previous period's figure, under the current one. */
function Was({ value }: { value: string }) {
  return (
    <span className="text-muted-foreground block text-xs">was {value}</span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
