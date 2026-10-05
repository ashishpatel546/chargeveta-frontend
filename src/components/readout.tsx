import { cn } from '@/lib/utils';

/** A trailing unit `lib/format.ts` puts on a figure: "31.850 kWh", "12 min", "99.8%". */
const UNIT = /^(.*?\d)\s?(kWh|kW|min|h|%)$/;

/**
 * A formatted figure set as a meter reads: the number condensed and large,
 * its unit small and quiet beside it. Takes the already-formatted string, so
 * every number still goes through `lib/format.ts`.
 */
export function Readout({
  value,
  className,
  unitClassName,
}: {
  value: string;
  className?: string;
  unitClassName?: string;
}) {
  const match = UNIT.exec(value);
  return (
    <span className={cn('readout', className)}>
      {match ? match[1] : value}
      {match ? (
        <span
          className={cn(
            'text-muted-foreground ml-[0.12em] text-[0.5em] font-medium tracking-normal',
            unitClassName,
          )}
        >
          {match[2]}
        </span>
      ) : null}
    </span>
  );
}
