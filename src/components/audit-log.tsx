'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Pieces both audit logs share — the platform's (`/platform/audit`) and a
 * tenant's (`/audit`): a labelled filter, and a row's details as short text.
 */

export const ALL = 'all';

export function FilterSelect({
  value,
  onChange,
  items,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next ?? ALL)} items={items}>
      <SelectTrigger className="w-56" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * A row's details as short "key: value" pairs; a change as "from → to", a
 * configuration setting as "key = value".
 * Nothing secret is ever in them — the API refuses to write such a key.
 */
export function describeDetails(detail: Record<string, unknown>): string {
  const parts = Object.entries(detail).map(
    ([key, value]) => `${key}: ${shown(value)}`,
  );
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function shown(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(shown).join(', ') : 'none';
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('from' in record && 'to' in record) {
      return `${shown(record.from)} → ${shown(record.to)}`;
    }
    // A configuration change: `key = value` (a credential's value arrives
    // already `[redacted]`).
    if ('key' in record && 'value' in record) {
      return `${shown(record.key)} = ${shown(record.value)}`;
    }
    return JSON.stringify(value);
  }
  return String(value);
}
