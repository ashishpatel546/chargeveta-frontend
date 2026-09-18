/**
 * Turning the API's strings into something to read.
 *
 * The API sends money in minor units and energy in watt-hours, both as decimal
 * **strings**, because they are `numeric` in Postgres and a JavaScript number
 * loses them. Everything here is for display only: no value that came from one
 * of these functions is ever sent back. Arithmetic on a bill belongs to the
 * API, which has the tariff and the tax rules.
 */

const LOCALE = 'en-IN';

/** `"1850"`, `"INR"` → `"₹18.50"`. */
export function money(
  minor: string | undefined,
  currency: string | undefined,
): string {
  if (minor === undefined || currency === undefined) return '—';
  const value = Number(minor) / 100;
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
  }).format(value);
}

/** Watt-hours as kWh, which is how everyone in the industry reads them. */
export function energy(wh: string | undefined): string {
  if (wh === undefined) return '—';
  const value = Number(wh);
  if (!Number.isFinite(value)) return '—';
  return `${(value / 1000).toLocaleString(LOCALE, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} kWh`;
}

export function power(w: string | undefined): string {
  if (w === undefined) return '—';
  const value = Number(w);
  if (!Number.isFinite(value)) return '—';
  return `${(value / 1000).toLocaleString(LOCALE, {
    maximumFractionDigits: 2,
  })} kW`;
}

/** A moment, in the reader's own time zone. */
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  return at.toLocaleString(LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function date(iso: string | null | undefined): string {
  if (!iso) return '—';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  return at.toLocaleDateString(LOCALE, { dateStyle: 'medium' });
}

const UNITS: [limit: number, seconds: number, name: Intl.RelativeTimeFormatUnit][] =
  [
    [60, 1, 'second'],
    [3600, 60, 'minute'],
    [86400, 3600, 'hour'],
    [2592000, 86400, 'day'],
  ];

/** "4 minutes ago", for a column that answers "is this thing alive?". */
export function since(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return '—';
  const seconds = (at - Date.now()) / 1000;
  const magnitude = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  for (const [limit, divisor, unit] of UNITS) {
    if (magnitude < limit) {
      return formatter.format(Math.round(seconds / divisor), unit);
    }
  }
  return formatter.format(Math.round(seconds / 2592000), 'month');
}

/** How long a session ran, from two instants. */
export function span(from: string, to: string | undefined): string {
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return '—';
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** Seconds, for the availability report's columns. */
export function hours(seconds: number): string {
  return `${(seconds / 3600).toLocaleString(LOCALE, {
    maximumFractionDigits: 1,
  })} h`;
}

/** A fraction the API sends as 0–1, shown as a percentage. */
export function percent(value: number | null): string {
  if (value === null) return '—';
  return `${(value * 100).toLocaleString(LOCALE, {
    maximumFractionDigits: 1,
  })}%`;
}
