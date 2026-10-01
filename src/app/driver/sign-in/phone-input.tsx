'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COUNTRIES, DIAL_CODES } from '@/lib/dial-codes';

/**
 * A phone number as country + number, the country preselected from where the
 * driver is (`detectCountry()`), so they type only their own digits. What
 * reaches the form is one international number in the hidden `name` field —
 * or, when the driver types a `+` themselves, exactly what they typed.
 *
 * The country is the app's own `Select`, showing the region and calling code
 * (`IN +91`). Not a flag emoji: Windows draws none, only the two letters run
 * into the code. And not a native `<select>` made invisible over that label:
 * Chrome drew the native control's own text through it for the owner. The
 * country names render only in the open list, never in the server's HTML, so
 * they cannot fail hydration either.
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
      <Select
        value={country}
        onValueChange={(next) => {
          if (next) setCountry(next);
        }}
      >
        <SelectTrigger aria-label="Country" className="shrink-0">
          <SelectValue>
            {(region: string) => (
              <>
                <span className="text-muted-foreground text-xs font-medium">
                  {region}
                </span>
                <span className="tabular-nums">+{DIAL_CODES[region]}</span>
              </>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} className="w-72">
          {COUNTRIES.map(([region, label, code]) => (
            <SelectItem key={region} value={region}>
              {label} (+{code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
