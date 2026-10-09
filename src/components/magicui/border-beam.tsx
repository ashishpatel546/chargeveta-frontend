import { cn } from '@/lib/utils';

/**
 * A short streak of light that travels round an element's edge, like Magic
 * UI's BorderBeam: a gradient "head" moving along `offset-path`, visible only
 * through a ring-shaped mask, with an optional blurred copy behind as glow.
 * CSS only, one compositor-friendly animation, stopped under reduced motion.
 *
 * Put it as the last child of a `relative` element and pass that element's
 * corner radius. `live` is amber, for a charge in progress (the one thing
 * amber means); `arc` is the indigo light round the sign-in forms.
 */
export function BorderBeam({
  tone,
  radius,
  halo = false,
  duration = 7,
  length = 90,
  className,
}: {
  tone: 'live' | 'arc';
  /** The element's corner radius, in px. */
  radius: number;
  /** A soft glow outside the edge as the streak passes. */
  halo?: boolean;
  /** Seconds per lap. */
  duration?: number;
  /** Length of the streak, in px. */
  length?: number;
  className?: string;
}) {
  const style = {
    '--beam-color': tone === 'live' ? 'var(--current)' : 'var(--arc)',
    '--beam-radius': `${radius}px`,
    '--beam-duration': `${duration}s`,
    '--beam-length': `${length}px`,
  } as React.CSSProperties;
  return (
    <span aria-hidden className="beam-clip">
      {halo ? (
        <span aria-hidden className="beam-halo" style={style}>
          <span className="beam-head" />
        </span>
      ) : null}
      <span aria-hidden className={cn('beam-edge', className)} style={style}>
        <span className="beam-head" />
      </span>
    </span>
  );
}
