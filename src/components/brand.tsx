import { config } from '@/lib/config';
import { cn } from '@/lib/utils';

/**
 * The bolt of `app/icon.svg`, on an ink tile. `inverted` is for ink
 * surfaces (the console sidebar, the sign-in panel), where the tile turns
 * white and the bolt ink. Never amber: amber is reserved for live energy.
 */
export function BrandMark({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-[9px]',
        inverted ? 'bg-white text-ink' : 'bg-primary text-primary-foreground',
        className,
      )}
    >
      <svg viewBox="0 0 64 64" className="size-[62%]">
        <path
          d="M36 6 14 36h16l-4 22 24-32H34z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** The mark and the app's name, as every shell's top-left shows them. */
export function Wordmark({
  suffix,
  inverted = false,
  className,
}: {
  /** "platform", "fleet" — which surface this is, when it is not the main one. */
  suffix?: string;
  inverted?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark inverted={inverted} />
      <span className="heading text-[17px] leading-none">
        {config.appName}
        {suffix ? (
          <span
            className={cn(
              'ml-1.5 font-normal',
              inverted ? 'text-sidebar-foreground' : 'text-muted-foreground',
            )}
          >
            {suffix}
          </span>
        ) : null}
      </span>
    </span>
  );
}
