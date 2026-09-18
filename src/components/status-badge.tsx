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
  Available: 'border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
  Occupied: 'border-sky-600/30 bg-sky-600/10 text-sky-700 dark:text-sky-400',
  Reserved: 'border-violet-600/30 bg-violet-600/10 text-violet-700 dark:text-violet-400',
  Unavailable: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  Faulted: 'border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400',
};

export function ConnectorBadge({ status }: { status: ConnectorStatus }) {
  return (
    <Badge variant="outline" className={cn('font-medium', CONNECTOR_TONE[status])}>
      {status}
    </Badge>
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
function useMinute(): number {
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
export function LiveBadge({ lastSeenAt }: { lastSeenAt: string | null }) {
  const now = useMinute();

  if (!lastSeenAt) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        never seen
      </Badge>
    );
  }
  const minutes = (now - new Date(lastSeenAt).getTime()) / 60000;
  if (minutes <= 15) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-600/30 bg-emerald-600/10 font-medium text-emerald-700 dark:text-emerald-400"
      >
        online
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-amber-600/30 bg-amber-600/10 font-medium text-amber-700 dark:text-amber-500"
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
          ? 'border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
          : 'border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-500',
      )}
    >
      {outcome.replace(/_/g, ' ')}
    </Badge>
  );
}
