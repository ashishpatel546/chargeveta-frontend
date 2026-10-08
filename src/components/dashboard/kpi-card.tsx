import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
  MinusIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Readout } from '@/components/readout';
import { LiveBeam } from '@/components/magicui/live-beam';
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
  compact = false,
  href,
}: {
  label: string;
  kpi: Kpi;
  /** Formats a value the API sent (a decimal string) for display. */
  format: (value: string | null) => string;
  better?: Better;
  /** A line under the figure, such as what it is measured against. */
  hint?: string;
  /** A supporting figure: smaller, so the headline row carries the screen. */
  compact?: boolean;
  /** Where the rows behind the figure are, when there is such a list. */
  href?: string;
}) {
  const card = (
    <Card
      size="sm"
      className={cn(
        'h-full',
        href && 'group-hover:ring-ring/40 transition-shadow',
      )}
    >
      <CardContent className="space-y-1.5">
        <p className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
          {label}
          {href ? (
            <ChevronRightIcon
              aria-hidden
              className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
            />
          ) : null}
        </p>
        <p className="truncate">
          <Readout
            value={format(kpi.current)}
            className={compact ? 'text-2xl' : 'text-[40px]'}
          />
        </p>
        <Change kpi={kpi} format={format} better={better} />
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link
      href={href}
      className="group block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {card}
    </Link>
  ) : (
    card
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
          good === true && 'text-ok-ink',
          good === false && 'text-destructive',
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

/**
 * Open sessions, right now — the one figure on the dashboard that is live
 * rather than a period's total, so it is the one that lights up: ink with
 * the amber current while anything is charging, an ordinary card when not.
 */
export function ChargingNowCard({ count }: { count: number }) {
  const live = count > 0;
  return (
    <Card
      size="sm"
      className={cn(
        'relative h-full',
        live && 'bg-ink text-white ring-0 dark:ring-1 dark:ring-white/10',
      )}
    >
      <CardContent className="space-y-1.5">
        <p
          className={cn(
            'flex items-center gap-1.5 text-xs',
            live ? 'text-sidebar-foreground' : 'text-muted-foreground',
          )}
        >
          {live ? (
            <span aria-hidden className="bg-live size-1.5 rounded-full" />
          ) : null}
          Charging now
        </p>
        <p className={cn('readout text-[40px]', live && 'text-live')}>
          {count.toLocaleString('en-IN')}
        </p>
        <p
          className={cn(
            'text-xs',
            live ? 'text-sidebar-foreground' : 'text-muted-foreground',
          )}
        >
          {live
            ? `Open ${count === 1 ? 'session' : 'sessions'}, whatever the period`
            : 'Nothing charging right now'}
        </p>
      </CardContent>
      {live ? <LiveBeam radius={17} /> : null}
    </Card>
  );
}
