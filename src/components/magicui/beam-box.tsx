import { BorderBeam } from '@/components/magicui/border-beam';
import { cn } from '@/lib/utils';

/**
 * The box round the sign-in and sign-up forms: a card whose edge carries a
 * travelling streak of indigo light. Indigo, not amber, on purpose: amber
 * means a charge is running, and nothing on a sign-in page is.
 */
export function BeamBox({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative isolate rounded-[28px]', className)}>
      {/* The card is its own layer so the glow (z -1) can sit behind it: a
          negative z-index still paints above its stacking root's background. */}
      <div className="bg-card relative rounded-[inherit] border shadow-[0_24px_60px_-32px_rgb(26_33_80/0.35)]">
        {children}
      </div>
      <BorderBeam tone="arc" radius={28} halo duration={8} length={280} />
    </div>
  );
}
