'use client';

import { InfoDialog } from '@/components/info-dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RoundingMode } from './definition';

/** What each mode is called on a screen; the API's names are code. */
export const ROUNDING_LABELS: Record<RoundingMode, string> = {
  half_up: 'Half up (standard)',
  half_even: 'Half even (banker’s)',
};

export function roundingLabel(mode: string | null | undefined): string {
  if (!mode) return '—';
  return ROUNDING_LABELS[mode as RoundingMode] ?? mode;
}

/**
 * The rounding picker, with what it means.
 *
 * Shared by the new-tariff and new-version dialogs so the two cannot explain
 * the same setting differently.
 */
export function RoundingField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: RoundingMode;
  onChange: (value: RoundingMode) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Label htmlFor={id}>Rounding</Label>
        <RoundingInfo />
      </div>
      <Select
        value={value}
        onValueChange={(next) =>
          onChange((next as RoundingMode | null) ?? 'half_up')
        }
      >
        <SelectTrigger id={id} className="w-56">
          <SelectValue>{(mode: string) => roundingLabel(mode)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="half_up">{ROUNDING_LABELS.half_up}</SelectItem>
          <SelectItem value="half_even">{ROUNDING_LABELS.half_even}</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-muted-foreground max-w-64 text-xs">
        Prices can work out to a fraction of a paisa; this decides which way a
        cost line goes. Only matters at exactly half. If unsure, keep half up.
      </p>
    </div>
  );
}

export function RoundingInfo() {
  return (
    <InfoDialog
      title="Rounding"
      summary="How a cost that works out to a fraction of the smallest coin becomes an amount you can charge."
    >
      <p>
        Rates can have up to four decimal places of a paisa — ₹0.50 a minute is
        50 paise, but a per-minute price like 8.3333 paise is common. Multiply
        that by the minutes or kWh of a real session and the result is rarely a
        whole number of paise, so it has to be rounded.
      </p>

      <h3>The two choices</h3>
      <p>
        Both round to the <strong>nearest</strong> paisa. They only disagree
        when a line lands <strong>exactly halfway</strong> between two paise:
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-2 font-medium">Works out to</th>
              <th className="p-2 font-medium">Half up</th>
              <th className="p-2 font-medium">Half even</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-t [&_td]:p-2">
            <tr>
              <td>1234.4 paise</td>
              <td>1234</td>
              <td>1234</td>
            </tr>
            <tr>
              <td>1234.6 paise</td>
              <td>1235</td>
              <td>1235</td>
            </tr>
            <tr>
              <td>1234.5 paise</td>
              <td>1235 (up)</td>
              <td>1234 (to the even one)</td>
            </tr>
            <tr>
              <td>1235.5 paise</td>
              <td>1236 (up)</td>
              <td>1236 (to the even one)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul>
        <li>
          <strong>Half up</strong> — a half always goes up. This is how most
          people round, and what a driver checking their receipt by hand will
          expect. Recommended.
        </li>
        <li>
          <strong>Half even</strong> (banker’s rounding) — a half goes to
          whichever neighbour is even, so over thousands of sessions the halves
          that go up and down cancel out instead of all adding up. Choose it
          only if your accounts team asks for it.
        </li>
      </ul>

      <h3>What gets rounded</h3>
      <p>
        Each line on the receipt — session fee, energy, charging time, idle,
        occupancy — is rounded once, on its own. The total is the sum of those
        rounded lines, so the lines on a receipt always add up exactly to the
        total printed under them. GST is then added on that total, and each
        GST line (CGST, SGST or IGST) is rounded the same way.
      </p>
      <p className="text-muted-foreground">
        The difference between the two is never more than one paisa per line.
        Each version of a tariff keeps its own rounding, and a new version
        starts from the previous one’s.
      </p>
    </InfoDialog>
  );
}
