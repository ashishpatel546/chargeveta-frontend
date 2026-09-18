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

function filenameFrom(disposition: string | null, fallback: string): string {
  const match = disposition?.match(/filename="?([^";]+)"?/);
  return match ? match[1] : fallback;
}

/**
 * The same report as a file.
 *
 * `apiGet` is not used: it asks for JSON and parses what comes back, and this
 * route answers `text/csv` with the filename the API chose in
 * `Content-Disposition`. The proxy passes both headers through, so the file
 * the reader saves is named by the API rather than by this screen.
 */
export async function downloadCsv(
  path: string,
  params: Record<string, string | undefined>,
  fallbackName: string,
): Promise<void> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, value);
  }
  query.set('format', 'csv');

  const response = await fetch(`/api/cv${path}?${query.toString()}`, {
    headers: { accept: 'text/csv' },
  });
  if (!response.ok) {
    let message = `The API answered ${response.status}`;
    try {
      const body = (await response.json()) as { message?: unknown };
      if (typeof body.message === 'string') message = body.message;
      else if (Array.isArray(body.message)) message = body.message.join('; ');
    } catch {
      // Not JSON; the status will have to do.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filenameFrom(
    response.headers.get('content-disposition'),
    fallbackName,
  );
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
