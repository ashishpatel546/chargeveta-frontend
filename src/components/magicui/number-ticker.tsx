'use client';

import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

/**
 * A number that rolls to its new value instead of jumping — adapted from
 * Magic UI's NumberTicker. For live readings (a running session's kWh, a
 * board's kW) so a refresh reads as the meter moving, not as a repaint.
 *
 * Display only, like everything in `lib/format.ts`: the in-between values it
 * shows are never sent anywhere. The first render prints the real value (so
 * the server's HTML is right and nothing counts up from zero on load); only
 * later changes animate, and not at all under reduced motion.
 */
export function NumberTicker({
  value,
  format,
  className,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = shown.current;
    if (from === value || reduce) {
      shown.current = value;
      node.textContent = format(value);
      return;
    }
    const controls = animate(from, value, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        shown.current = latest;
        node.textContent = format(latest);
      },
    });
    return () => controls.stop();
  }, [value, format, reduce]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
