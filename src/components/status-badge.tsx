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
  Reserved: 'border-violet-600/30 bg-violet-600/10 text-violet-700 dark:text-violet-400',
  Unavailable: 'border-border bg-muted text-muted-foreground',
  Faulted: 'border-destructive/30 bg-destructive/10 text-destructive',
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
