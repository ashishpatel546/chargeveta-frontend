/**
 * A report or dashboard table as a file, through one of this app's proxies.
 *
 * `apiGet` is not used: it asks for JSON and parses what comes back, and these
 * routes answer `text/csv` with the filename the API chose in
 * `Content-Disposition`. The proxies pass both headers through, so the file
 * the reader saves is named by the API rather than by the screen.
 */

function filenameFrom(disposition: string | null, fallback: string): string {
  const match = disposition?.match(/filename="?([^";]+)"?/);
  return match ? match[1] : fallback;
}

export async function downloadCsvVia(
  /** `/api/cv` for staff, `/api/cvf` for a fleet manager. */
  proxy: '/api/cv' | '/api/cvf',
  path: string,
  params: Record<string, string | undefined>,
  fallbackName: string,
): Promise<void> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, value);
  }
  query.set('format', 'csv');

  const response = await fetch(`${proxy}${path}?${query.toString()}`, {
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
