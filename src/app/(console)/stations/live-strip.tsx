'use client';

import { LiveBeam } from '@/components/magicui/live-beam';
import { Readout } from '@/components/readout';
import { Skeleton } from '@/components/ui/skeleton';
import type { StationBoard } from '@/lib/api/types';
import { energy } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The fleet right now, above the charger list: one instrument strip rather
 * than a row of cards, so it reads as a single panel of gauges.
 *
 * "Charging now" is the one cell that lights up (ink and amber while anything
 * is charging), the same treatment as the dashboard's card. Faulted turns red
 * only when it is not zero. The two cells that name a subset of chargers are
 * buttons that narrow the list below to it.
 */
export function LiveStrip({
  board,
  onFaulted,
  onOffline,
}: {
  board: StationBoard | undefined;
  onFaulted: () => void;
  onOffline: () => void;
}) {
  if (!board) {
    return <Skeleton className="mb-5 h-[104px] w-full rounded-xl" />;
  }
  const s = board.summary;
  const live = s.chargingNow > 0;
  const stations = s.onlineStations + s.offlineStations;

  return (
    <section
      aria-label="Your chargers right now"
      className="bg-border mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-3 lg:grid-cols-5"
    >
      <div
        className={cn(
          'bg-card relative col-span-2 p-4 sm:col-span-1',
          live && 'bg-ink text-white',
        )}
      >
        <p
          className={cn(
            'flex items-center gap-1.5 text-xs',
            live ? 'text-sidebar-foreground' : 'text-muted-foreground',
          )}
        >
          {live ? (
            <span
              aria-hidden
              className="bg-live size-1.5 animate-pulse rounded-full"
            />
          ) : null}
          Charging now
        </p>
        <p className={cn('readout mt-2 text-[34px]', live && 'text-live')}>
          {s.chargingNow.toLocaleString('en-IN')}
        </p>
        <p
          className={cn(
            'mt-1 text-xs',
            live ? 'text-sidebar-foreground' : 'text-muted-foreground',
          )}
        >
          {live
            ? `${s.chargingNow === 1 ? 'session' : 'sessions'} on online chargers`
            : 'Nothing is charging'}
        </p>
        {live ? <LiveBeam radius={0} /> : null}
      </div>

      <Cell
        label="Faulted"
        value={s.faultedConnectors.toLocaleString('en-IN')}
        hint={
          s.faultedConnectors === 0
            ? 'No faults reported'
            : 'Show those chargers'
        }
        tone={s.faultedConnectors > 0 ? 'bad' : undefined}
        onClick={s.faultedConnectors > 0 ? onFaulted : undefined}
      />
      <Cell
        label="Available"
        value={s.availableConnectors.toLocaleString('en-IN')}
        hint={`of ${s.totalConnectors.toLocaleString('en-IN')} connectors free to use`}
      />
      <Cell
        label="Online"
        value={`${s.onlineStations.toLocaleString('en-IN')}`}
        hint={
          s.offlineStations > 0
            ? `of ${stations} chargers. See the ${s.offlineStations} offline`
            : `of ${stations} chargers`
        }
        onClick={s.offlineStations > 0 ? onOffline : undefined}
      />
      <Cell
        label="Energy today"
        value={energy(s.energyWh)}
        hint="Sessions started since midnight"
        last
      />
    </section>
  );
}

function Cell({
  label,
  value,
  hint,
  tone,
  onClick,
  last,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'bad';
  onClick?: () => void;
  last?: boolean;
}) {
  const body = (
    <>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-2">
        <Readout
          value={value}
          className={cn('text-[34px]', tone === 'bad' && 'text-destructive')}
        />
      </p>
      <p
        className={cn(
          'mt-1 text-xs',
          onClick
            ? 'text-foreground underline-offset-2 group-hover:underline'
            : 'text-muted-foreground',
        )}
      >
        {hint}
      </p>
    </>
  );
  const frame = cn(
    'bg-card p-4 text-left',
    last && 'sm:col-span-2 lg:col-span-1',
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        frame,
        'group hover:bg-muted focus-visible:ring-ring/50 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
      )}
    >
      {body}
    </button>
  ) : (
    <div className={frame}>{body}</div>
  );
}
