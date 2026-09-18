'use client';

import { money } from '@/lib/format';
import {
  describeBand,
  draftFromDefinition,
  type TariffDefinition,
} from './definition';

/**
 * A rate, which can be a fraction of a minor unit.
 *
 * `money` rounds to the currency's own places, so a rate of `"8.3333"` paise
 * would read as ₹0.08 and lose what makes it a rate. The minor-unit string is
 * kept beside it whenever it has decimals.
 */
function rate(value: string, currency: string): string {
  const shown = money(value, currency);
  return value.includes('.') ? `${shown} (${value} minor)` : shown;
}

/**
 * A version's prices in words.
 *
 * Anything the reader does not recognise falls through to the JSON below it,
 * so a definition written by a newer build is still visible rather than
 * silently half-shown.
 */
export function DefinitionView({
  definition,
  currency,
}: {
  definition: unknown;
  currency: string;
}) {
  const known = draftFromDefinition(definition);
  if (!known) {
    return (
      <p className="text-muted-foreground text-sm">
        This definition has parts this console does not know. The JSON below is
        what was stored.
      </p>
    );
  }

  const parts = definition as TariffDefinition;
  const lines: { label: string; value: string; detail?: string[] }[] = [];

  if (parts.sessionFeeMinor !== undefined) {
    lines.push({
      label: 'Session fee',
      value: money(String(parts.sessionFeeMinor), currency),
    });
  }
  if (parts.energy) {
    lines.push({
      label: 'Energy',
      value: `${rate(parts.energy.pricePerKwhMinor, currency)} per kWh`,
      detail: (parts.energy.timeOfDay ?? []).map(
        (band) =>
          `${describeBand(band)} — ${rate(band.pricePerKwhMinor, currency)} per kWh`,
      ),
    });
  }
  if (parts.chargingTime) {
    lines.push({
      label: 'Charging time',
      value: `${rate(parts.chargingTime.pricePerMinuteMinor, currency)} per minute`,
    });
  }
  if (parts.idle) {
    lines.push({
      label: 'Idle',
      value: `${rate(parts.idle.pricePerMinuteMinor, currency)} per minute after ${parts.idle.graceMinutes} min grace`,
    });
  }
  if (parts.occupancy) {
    lines.push({
      label: 'Occupancy',
      value: `${rate(parts.occupancy.pricePerMinuteMinor, currency)} per minute after ${parts.occupancy.graceMinutes} min grace`,
    });
  }

  return (
    <dl className="space-y-2 text-sm">
      {lines.map((line) => (
        <div key={line.label}>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground w-32 shrink-0">
              {line.label}
            </dt>
            <dd>{line.value}</dd>
          </div>
          {line.detail && line.detail.length > 0 ? (
            <ul className="text-muted-foreground mt-1 ml-32 list-disc space-y-0.5 pl-4 text-xs">
              {line.detail.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

/** Whatever was stored, formatted, behind a disclosure. */
export function JsonBlock({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <details className="rounded-md border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        {label}
      </summary>
      <pre className="bg-muted/50 overflow-x-auto p-3 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
