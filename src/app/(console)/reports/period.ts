import { downloadCsvVia } from '@/lib/download';

/**
 * The period a report covers, and getting the same rows out as a file.
 *
 * Both reports take `from` and `to` as local dates — `YYYY-MM-DD` — read in
 * each site's own time zone by the API, not the reader's. The API caps a
 * period at 366 days; the cap is checked here too so an obviously too-long
 * range never becomes a request, and the API's own refusal still shows if the
 * two ever disagree.
 */

export const MAX_DAYS = 366;

const DAY_MS = 86_400_000;

/** A date as the input and the API both want it, in the reader's own zone. */
export function localDate(at: Date): string {
  const year = at.getFullYear();
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today and the 29 days before it: 30 days, both ends included. */
export function lastThirtyDays(): { from: string; to: string } {
  const today = new Date();
  return {
    from: localDate(new Date(today.getTime() - 29 * DAY_MS)),
    to: localDate(today),
  };
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
    return `A report covers at most ${MAX_DAYS} days; this asks for ${days}.`;
  }
  return null;
}

/** The same report as a file, through the staff proxy (`lib/download.ts`). */
export function downloadCsv(
  path: string,
  params: Record<string, string | undefined>,
  fallbackName: string,
): Promise<void> {
  return downloadCsvVia('/api/cv', path, params, fallbackName);
}
