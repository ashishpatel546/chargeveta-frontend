import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Kpi } from '@/lib/api/types';
import { cn } from '@/lib/utils';

/**
 * Which way a figure should move. `up`: more is better (sessions, revenue);
 * `down`: less is better (refused taps, unpriced sessions); `neutral`: neither
 * (an average session length is not good or bad by itself).
 */
export type Better = 'up' | 'down' | 'neutral';

/**
 * One KPI: the figure for the period, and how it moved against the period
 * before it. The change is the API's percentage; the arrow and the sign carry
 * the direction, so colour is never the only channel (doc 7 §7).
 */
export function KpiCard({
  label,
  kpi,
  format,
  better = 'up',
  hint,
}: {
  label: string;
  kpi: Kpi;
  /** Formats a value the API sent (a decimal string) for display. */
  format: (value: string | null) => string;
  better?: Better;
  /** A line under the figure, such as what it is measured against. */
  hint?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">
          {format(kpi.current)}
        </p>
        <Change kpi={kpi} format={format} better={better} />
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function Change({
  kpi,
  format,
  better,
}: {
  kpi: Kpi;
  format: (value: string | null) => string;
  better: Better;
}) {
  const before = `was ${format(kpi.previous)}`;
  if (kpi.changePct === null) {
    return <p className="text-muted-foreground text-xs">{before}</p>;
  }
  const change = kpi.changePct;
  const Icon =
    change > 0 ? ArrowUpRightIcon : change < 0 ? ArrowDownRightIcon : MinusIcon;
  const good =
    better === 'neutral' || change === 0
      ? null
      : (better === 'up') === change > 0;
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 font-medium',
          good === true && 'text-emerald-700 dark:text-emerald-400',
          good === false && 'text-red-700 dark:text-red-400',
          good === null && 'text-muted-foreground',
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {change > 0 ? '+' : ''}
        {change.toLocaleString('en-IN', { maximumFractionDigits: 1 })}%
      </span>
      <span className="text-muted-foreground">{before}</span>
    </p>
  );
}
