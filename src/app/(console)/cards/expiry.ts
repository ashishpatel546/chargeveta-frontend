/**
 * The expiry date, between a date box and the API's instant.
 *
 * The API stores a moment, not a day, and a card is refused from that moment
 * on. An operator typing "31 December" means the card works all of the 31st, so
 * the day picked here becomes the last second of that day in the reader's own
 * zone rather than its first.
 */

export function toExpiryIso(day: string): string | undefined {
  if (!day) return undefined;
  const at = new Date(`${day}T23:59:59`);
  if (Number.isNaN(at.getTime())) return undefined;
  return at.toISOString();
}

/** The other direction, for filling the date box from a stored expiry. */
export function toDayInput(iso: string | null): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${at.getFullYear()}-${month}-${day}`;
}
