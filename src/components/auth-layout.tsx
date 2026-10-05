import { Wordmark } from '@/components/brand';
import { BeamBox } from '@/components/magicui/beam-box';
import { cn } from '@/lib/utils';

type Surface = 'console' | 'driver' | 'fleet' | 'platform';

/** What the ink panel says on each surface, beside the form. */
const PANEL: Record<Surface, { suffix?: string; line: string; detail: string }> = {
  console: {
    line: 'Every charger, every session, one console.',
    detail: 'Chargers, tariffs, receipts and payments for your whole network.',
  },
  driver: {
    line: 'Plug in. Charge. Pay from your phone.',
    detail: 'Find a free charger, start a session and get your receipt.',
  },
  fleet: {
    suffix: 'fleet',
    line: "Your fleet's charging, on one statement.",
    detail: 'Sessions, drivers and spend for every vehicle you manage.',
  },
  platform: {
    suffix: 'platform',
    line: 'The operators on this installation.',
    detail: 'Create operators, manage platform admins and keep an eye on usage.',
  },
};

/**
 * The frame every signed-out page sits in: sign-in, register, setup links,
 * password changes. On a large screen an ink panel says what this surface is
 * for; on a phone or tablet the form stands alone under the wordmark, since
 * that is all anyone opening it there needs.
 */
export function AuthLayout({
  surface,
  children,
  className,
}: {
  surface: Surface;
  children: React.ReactNode;
  className?: string;
}) {
  const panel = PANEL[surface];
  return (
    <div className="flex flex-1 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="bg-ink relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <Wordmark inverted suffix={panel.suffix} className="relative z-10" />
        <div className="relative z-10 -mt-24 max-w-md space-y-4">
          <p className="heading text-4xl leading-[1.05] xl:text-5xl">{panel.line}</p>
          <p className="text-sidebar-foreground max-w-sm text-base">
            {panel.detail}
          </p>
        </div>
        <span />
        <ConnectorField />
      </aside>

      <main
        className={cn(
          'mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10 sm:px-8 lg:max-w-[30rem] lg:py-16',
          // Touch-sized controls (`globals.css`): these forms are filled in
          // on phones, and are the first thing anyone sees.
          'roomy',
          className,
        )}
      >
        <Wordmark suffix={panel.suffix} className="mb-2 lg:hidden" />
        <BeamBox>
          <div className="flex flex-col gap-6 p-6 sm:p-8">{children}</div>
        </BeamBox>
      </main>
    </div>
  );
}

/**
 * The panel's backdrop: a field of connector tiles, the console's live board
 * with the lights off. Deliberately without amber — nothing here is charging.
 */
function ConnectorField() {
  const cells = Array.from({ length: 72 }, (_, i) => i);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 grid grid-cols-12 gap-2 p-6 opacity-60 [mask-image:linear-gradient(to_top,black,transparent_60%)]"
    >
      {cells.map((i) => (
        <span
          key={i}
          className={cn(
            'aspect-square rounded-md',
            // A fixed, irregular scatter: some tiles brighter, as if in use.
            (i * 7) % 11 === 0 || (i * 5) % 13 === 0 ? 'bg-white/14' : 'bg-white/5',
          )}
        />
      ))}
    </div>
  );
}
