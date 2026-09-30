/**
 * Period presets for the dashboards (`charveta` doc 6 §20.4, §23).
 *
 * A period is two local dates, `YYYY-MM-DD`, both included, which the API reads
 * in each site's own time zone. "Today" here is the reader's today — the only
 * one a browser knows — which is the same date as the site's everywhere but
 * near midnight across zones; the date pickers show exactly what was asked
 * for, so that edge is visible rather than hidden.
 *
 * The API compares every period with the one of equal length just before it
 * and caps a period at 366 days; `periodProblem` checks the cap here too so
 * an obviously too-long custom range never becomes a request.
 */

export const MAX_DAYS = 366;

const DAY_MS = 86_400_000;

export type PresetId =
  | 'today'
  | '7d'
  | '30d'
  | 'this-month'
  | 'last-month'
  | 'custom';

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'custom', label: 'Custom' },
];

export interface Period {
  preset: PresetId;
  from: string;
  to: string;
}

/** A date as the inputs and the API both want it, in the reader's own zone. */
export function localDate(at: Date): string {
  const year = at.getFullYear();
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The dates a preset stands for, as of `now`. */
export function presetPeriod(preset: PresetId, now = new Date()): Period {
  const today = localDate(now);
  const daysAgo = (n: number) => localDate(new Date(now.getTime() - n * DAY_MS));
  switch (preset) {
    case 'today':
      return { preset, from: today, to: today };
    case '7d':
      return { preset, from: daysAgo(6), to: today };
    case 'this-month':
      return {
        preset,
        from: localDate(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: today,
      };
    case 'last-month':
      return {
        preset,
        from: localDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: localDate(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case '30d':
    case 'custom':
    default:
      return { preset, from: daysAgo(29), to: today };
  }
}

/** What is wrong with a period, or `null` when nothing is. */
export function periodProblem(from: string, to: string): string | null {
  if (!from || !to) return 'Pick both dates.';
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 'Pick both dates.';
  if (end < start) return 'The end of the period is before its start.';
  const days = (end - start) / DAY_MS + 1;
  if (days > MAX_DAYS) {
    return `A period covers at most ${MAX_DAYS} days; this asks for ${days}.`;
  }
  return null;
}

/** `2030-01-15` → "15 Jan", for axis ticks; a local date, never re-zoned. */
export function shortDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** A series bucket key as a tick: "15 Jan", or "17:00" when by the hour. */
export function bucketLabel(key: string, bucket: 'hour' | 'day'): string {
  return bucket === 'hour' ? key.slice(11, 16) : shortDate(key);
}

/** "2–31 Aug 2030", for "compared with …". */
export function periodLabel(from: string, to: string): string {
  if (from === to) return shortDate(from);
  return `${shortDate(from)} – ${shortDate(to)}`;
}

/** A bucket in full, for a tooltip: "15 Jan", or "15 Jan, 17:00". */
export function bucketTitle(key: string, bucket: 'hour' | 'day'): string {
  return bucket === 'hour'
    ? `${shortDate(key)}, ${key.slice(11, 16)}`
    : shortDate(key);
}
