'use client';

import { useState, useSyncExternalStore } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { COUNTRIES, DIAL_CODES } from '@/lib/dial-codes';

const noSubscribe = () => () => {};

/** False while rendering on the server and hydrating, true after. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
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
 *
 * The label is the region code and calling code (`IN +91`), not a flag emoji:
 * Windows draws no flag emoji, only the two letters run into the code. The
 * full list of options is rendered only once hydrated — the server sends the
 * chosen one — so a browser (or a translating extension) that names a country
 * differently from the server cannot fail hydration.
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
  const hydrated = useHydrated();

  const dial = DIAL_CODES[country];
  const typed = number.trim();
  const value = typed.startsWith('+')
    ? typed
    : typed
      ? `+${dial}${typed.replace(/\D/g, '').replace(/^0+/, '')}`
      : '';

  return (
    <div className="flex gap-2">
      <div className="border-input relative flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-sm">
        <span className="text-muted-foreground text-xs font-medium" aria-hidden>
          {country}
        </span>
        <span className="tabular-nums">+{dial}</span>
        <ChevronDown className="text-muted-foreground size-3.5" aria-hidden />
        <select
          aria-label="Country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {(hydrated
            ? COUNTRIES
            : COUNTRIES.filter(([region]) => region === country)
          ).map(([region, label, code]) => (
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
