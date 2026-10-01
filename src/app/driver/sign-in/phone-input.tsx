'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { COUNTRIES, DIAL_CODES } from '@/lib/dial-codes';

/** A region's flag, from its two regional-indicator letters. */
function flag(region: string): string {
  return String.fromCodePoint(
    ...[...region].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/**
 * A phone number as country + number, the country preselected from where the
 * driver is (`detectCountry()`), so they type only their own digits.
 *
 * The country is a native `<select>` laid transparently over its own label:
 * the phone's own picker, searchable on both platforms, at no cost here. What
 * reaches the form is one international number in the hidden `name` field —
 * or, when the driver types a `+` themselves, exactly what they typed.
 */
export function PhoneInput({
  id,
  name,
  defaultCountry,
}: {
  id: string;
  name: string;
  defaultCountry: string;
}) {
  const [country, setCountry] = useState(
    defaultCountry in DIAL_CODES ? defaultCountry : 'IN',
  );
  const [number, setNumber] = useState('');

  const dial = DIAL_CODES[country];
  const typed = number.trim();
  const value = typed.startsWith('+')
    ? typed
    : typed
      ? `+${dial}${typed.replace(/\D/g, '').replace(/^0+/, '')}`
      : '';

  return (
    <div className="flex gap-2">
      <div className="border-input relative flex h-9 shrink-0 items-center gap-1 rounded-md border px-2.5 text-sm">
        <span aria-hidden>{flag(country)}</span>
        <span className="tabular-nums">+{dial}</span>
        <ChevronDown className="text-muted-foreground size-3.5" aria-hidden />
        <select
          aria-label="Country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {COUNTRIES.map(([region, label, code]) => (
            <option key={region} value={region}>
              {label} (+{code})
            </option>
          ))}
        </select>
      </div>
      <Input
        id={id}
        type="tel"
        autoComplete="tel-national"
        inputMode="tel"
        placeholder="Mobile number"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        required
        className="min-w-0"
      />
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
