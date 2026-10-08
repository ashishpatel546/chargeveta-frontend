'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { ConnectorStatus } from '@/lib/api/types';
import { cn } from '@/lib/utils';

/**
 * A connector's status, coloured the way an operator reads a board: green is
 * free, blue is working, red wants attention.
 */
const CONNECTOR_TONE: Record<ConnectorStatus, string> = {
  Available: 'border-ok/30 bg-ok/10 text-ok-ink',
  Occupied: 'border-live/50 bg-live/15 text-live-ink',
  Reserved:
    'border-violet-600/30 bg-violet-600/10 text-violet-700 dark:text-violet-400',
  Unavailable: 'border-border bg-muted text-muted-foreground',
  Faulted: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export function ConnectorBadge({ status }: { status: ConnectorStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn('font-medium', CONNECTOR_TONE[status])}
    >
      {status}
    </Badge>
  );
}

/**
 * One connector on a charger row: a dot and a word, the way the mockups on
 * the website show it. "Charging" (amber, the only amber) is a session
 * flowing on it; the rest is the charger's own reported status. On a charger
 * that has gone quiet the chip greys out, since its last status may be stale.
 */
export function ConnectorChip({
  status,
  charging,
  stale,
  label,
}: {
  status: ConnectorStatus;
  charging: boolean;
  stale: boolean;
  /** "1" or "2/1" when the charger has more than one, for telling them apart. */
  label?: string;
}) {
  const word = charging ? 'Charging' : status;
  const tone = stale
    ? 'border-border bg-muted/60 text-muted-foreground'
    : charging
      ? 'border-live/60 bg-live/20 text-live-ink'
      : CONNECTOR_TONE[status];
  const dot = stale
    ? 'bg-muted-foreground/50'
    : charging
      ? 'bg-live animate-pulse'
      : status === 'Available'
        ? 'bg-ok'
        : status === 'Faulted'
          ? 'bg-destructive'
          : status === 'Occupied'
            ? 'bg-live'
            : status === 'Reserved'
              ? 'bg-violet-600'
              : 'bg-muted-foreground';
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium whitespace-nowrap',
        tone,
      )}
    >
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', dot)} />
      {label ? <span className="opacity-60 tabular-nums">{label}</span> : null}
      {word}
    </span>
  );
}

/**
 * The current minute, and again when it changes.
 *
 * Reading the clock while rendering is not allowed — a component has to give
 * the same answer for the same props, and `Date.now()` does not. So the clock
 * is state, and a timer moves it. The badge below then goes from "online" to
 * "not heard from" on its own, without anything else having to re-render it.
 */
export function useMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * Whether a charger is talking to us.
 *
 * "Connected" is not something the API reports directly on a station; what it
 * reports is when the station was last heard from. A charger sends a heartbeat
 * on an interval it was told, so anything within a few minutes is alive.
 */
export type Liveness = 'online' | 'silent' | 'never';

/** The rule the badge below draws, for a filter that has to agree with it. */
export function liveness(lastSeenAt: string | null, now: number): Liveness {
  if (!lastSeenAt) return 'never';
  const minutes = (now - new Date(lastSeenAt).getTime()) / 60000;
  return minutes <= 15 ? 'online' : 'silent';
}

export function LiveBadge({ lastSeenAt }: { lastSeenAt: string | null }) {
  const state = liveness(lastSeenAt, useMinute());

  if (state === 'never') {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        never seen
      </Badge>
    );
  }
  if (state === 'online') {
    return (
      <Badge
        variant="outline"
        className="border-ok/30 bg-ok/10 font-medium text-ok-ink"
      >
        online
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-caution/30 bg-caution/10 font-medium text-caution-ink"
    >
      not heard from
    </Badge>
  );
}

/** The outcome word every remote command answers with. */
export function OutcomeBadge({ outcome }: { outcome: string }) {
  const good = outcome === 'answered';
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        good
          ? 'border-ok/30 bg-ok/10 text-ok-ink'
          : 'border-caution/30 bg-caution/10 text-caution-ink',
      )}
    >
      {outcome.replace(/_/g, ' ')}
    </Badge>
  );
}
