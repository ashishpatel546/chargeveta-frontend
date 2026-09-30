import { energy, money, percent } from '@/lib/format';

/**
 * Formatters for KPI values, which arrive as decimal strings or `null`. Every
 * one is for display only — nothing formatted here is ever sent back.
 */

export const count = (value: string | null): string =>
  value === null ? '—' : Number(value).toLocaleString('en-IN');

export const kwh = (value: string | null): string =>
  value === null ? '—' : energy(value);

/** Minutes as "42 min" or "1 h 05 min". */
export const minutes = (value: string | null): string => {
  if (value === null) return '—';
  const total = Math.round(Number(value));
  if (!Number.isFinite(total)) return '—';
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')} min`;
};

export const ratio = (value: string | null): string =>
  value === null ? '—' : percent(Number(value));

export const inCurrency =
  (currency: string) =>
  (value: string | null): string =>
    value === null ? '—' : money(value, currency);

/** Minor units per kWh, which the API sends to two places. */
export const perKwh =
  (currency: string) =>
  (value: string | null): string =>
    value === null ? '—' : `${money(value, currency)}/kWh`;

/** kWh as a plain number, for an axis. */
export const kwhNumber = (wh: string): number => Number(wh) / 1000;

/** Major units as a plain number, for an axis. */
export const majorNumber = (minor: string | undefined): number =>
  minor === undefined ? 0 : Number(minor) / 100;

/** A compact axis tick: 1 200 → "1.2k". */
export const compact = (value: number): string =>
  value.toLocaleString('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
