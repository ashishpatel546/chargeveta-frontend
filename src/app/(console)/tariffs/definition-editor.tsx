'use client';

import { useState } from 'react';
import { PlusIcon, TrashIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DAY_NAMES,
  EMPTY_BAND,
  type BandDraft,
  type DefinitionDraft,
  type EditorState,
  toFormMode,
  toJsonMode,
} from './definition';

/**
 * The parts of a tariff, as fields — with the raw JSON a switch away.
 *
 * Most tariffs are one or two of these parts, and a form says what the parts
 * are without the operator having to know the key names. The JSON view is kept
 * because the API is the thing that validates a definition: anything the form
 * cannot express can still be written and sent, and the API's refusal is what
 * explains it.
 */
export function DefinitionEditor({
  state,
  onChange,
  currency,
}: {
  state: EditorState;
  onChange: (next: EditorState) => void;
  /** Shown beside the rate fields, so "minor units" has a name. */
  currency: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const minor = currency === 'INR' ? 'paise' : `minor units of ${currency}`;

  function setDraft(next: DefinitionDraft) {
    onChange({ ...state, draft: next });
  }

  function switchTo(mode: 'form' | 'json') {
    setNotice(null);
    if (mode === state.mode) return;
    if (mode === 'json') {
      onChange(toJsonMode(state));
      return;
    }
    const back = toFormMode(state);
    if ('error' in back) {
      setNotice(back.error);
      return;
    }
    onChange(back);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Prices</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            size="xs"
            variant={state.mode === 'form' ? 'secondary' : 'ghost'}
            onClick={() => switchTo('form')}
          >
            Form
          </Button>
          <Button
            type="button"
            size="xs"
            variant={state.mode === 'json' ? 'secondary' : 'ghost'}
            onClick={() => switchTo('json')}
          >
            Advanced JSON
          </Button>
        </div>
      </div>

      {notice ? <p className="text-destructive text-xs">{notice}</p> : null}

      {state.mode === 'json' ? (
        <div className="space-y-2">
          <textarea
            value={state.json}
            onChange={(event) =>
              onChange({ ...state, json: event.target.value })
            }
            spellCheck={false}
            rows={14}
            aria-label="Definition JSON"
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border p-2 font-mono text-xs outline-none focus-visible:ring-3"
          />
          <p className="text-muted-foreground text-xs">
            Amounts and rates are in {minor}. Rates are strings with at most
            four decimals; <code>sessionFeeMinor</code> is a whole number.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <Part
            label="Session fee"
            hint="A flat amount on every session."
            on={state.draft.sessionFee.on}
            onToggle={(on) =>
              setDraft({
                ...state.draft,
                sessionFee: { ...state.draft.sessionFee, on },
              })
            }
          >
            <Field
              id="session-fee"
              label={`Amount (${minor})`}
              value={state.draft.sessionFee.amount}
              onChange={(amount) =>
                setDraft({
                  ...state.draft,
                  sessionFee: { ...state.draft.sessionFee, amount },
                })
              }
              placeholder="2000"
            />
          </Part>

          <Part
            label="Energy"
            hint="Per kWh delivered."
            on={state.draft.energy.on}
            onToggle={(on) =>
              setDraft({
                ...state.draft,
                energy: { ...state.draft.energy, on },
              })
            }
          >
            <Field
              id="energy-price"
              label={`Per kWh (${minor})`}
              value={state.draft.energy.price}
              onChange={(price) =>
                setDraft({
                  ...state.draft,
                  energy: { ...state.draft.energy, price },
                })
              }
              placeholder="1850"
            />
            <Bands
              bands={state.draft.energy.bands}
              minor={minor}
              onChange={(bands) =>
                setDraft({
                  ...state.draft,
                  energy: { ...state.draft.energy, bands },
                })
              }
            />
          </Part>

          <Part
            label="Charging time"
            hint="Per minute, from the start until energy stopped flowing."
            on={state.draft.chargingTime.on}
            onToggle={(on) =>
              setDraft({
                ...state.draft,
                chargingTime: { ...state.draft.chargingTime, on },
              })
            }
          >
            <Field
              id="charging-time-price"
              label={`Per minute (${minor})`}
              value={state.draft.chargingTime.price}
              onChange={(price) =>
                setDraft({
                  ...state.draft,
                  chargingTime: { ...state.draft.chargingTime, price },
                })
              }
              placeholder="50"
            />
          </Part>

          <Part
            label="Idle"
            hint="Per minute after charging finished, while the car stays plugged in."
            on={state.draft.idle.on}
            onToggle={(on) =>
              setDraft({ ...state.draft, idle: { ...state.draft.idle, on } })
            }
          >
            <Field
              id="idle-price"
              label={`Per minute (${minor})`}
              value={state.draft.idle.price}
              onChange={(price) =>
                setDraft({
                  ...state.draft,
                  idle: { ...state.draft.idle, price },
                })
              }
              placeholder="100"
            />
            <Field
              id="idle-grace"
              label="Grace (minutes)"
              value={state.draft.idle.grace}
              onChange={(value) =>
                setDraft({
                  ...state.draft,
                  idle: { ...state.draft.idle, grace: value },
                })
              }
              placeholder="15"
            />
          </Part>

          <Part
            label="Occupancy"
            hint="Per minute for the whole session, charging or not."
            on={state.draft.occupancy.on}
            onToggle={(on) =>
              setDraft({
                ...state.draft,
                occupancy: { ...state.draft.occupancy, on },
              })
            }
          >
            <Field
              id="occupancy-price"
              label={`Per minute (${minor})`}
              value={state.draft.occupancy.price}
              onChange={(price) =>
                setDraft({
                  ...state.draft,
                  occupancy: { ...state.draft.occupancy, price },
                })
              }
              placeholder="25"
            />
            <Field
              id="occupancy-grace"
              label="Grace (minutes)"
              value={state.draft.occupancy.grace}
              onChange={(value) =>
                setDraft({
                  ...state.draft,
                  occupancy: { ...state.draft.occupancy, grace: value },
                })
              }
              placeholder="0"
            />
          </Part>
        </div>
      )}
    </div>
  );
}

function Part({
  label,
  hint,
  on,
  onToggle,
  children,
}: {
  label: string;
  hint: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  children: React.ReactNode;
}) {
  const id = `part-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <input
          id={id}
          type="checkbox"
          checked={on}
          onChange={(event) => onToggle(event.target.checked)}
          className="accent-primary mt-0.5 size-4"
        />
        <div className="space-y-0.5">
          <Label htmlFor={id}>{label}</Label>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </div>
      </div>
      {on ? <div className="mt-3 space-y-3 pl-6">{children}</div> : null}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        spellCheck={false}
        className="max-w-48"
      />
    </div>
  );
}

/**
 * Time-of-day bands.
 *
 * A band replaces the plain per-kWh price during its hours, in the site's time
 * zone, and two bands may not cover the same minute. The overlap check is the
 * API's: it has the rule that pricing itself reads, so checking it twice is
 * two places for it to be wrong.
 */
function Bands({
  bands,
  minor,
  onChange,
}: {
  bands: BandDraft[];
  minor: string;
  onChange: (bands: BandDraft[]) => void;
}) {
  function replace(index: number, band: BandDraft) {
    onChange(bands.map((existing, at) => (at === index ? band : existing)));
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        Time-of-day bands replace the price above during their hours, in the
        site’s time zone. Bands may not overlap; leave the days unpicked for
        every day, and end at <code>24:00</code> for the end of the day.
      </p>

      {bands.map((band, index) => (
        <div key={index} className="space-y-2 rounded-md border p-2">
          <div className="flex flex-wrap items-end gap-2">
            <Field
              id={`band-${index}-start`}
              label="From"
              value={band.start}
              onChange={(start) => replace(index, { ...band, start })}
              placeholder="18:00"
            />
            <Field
              id={`band-${index}-end`}
              label="To"
              value={band.end}
              onChange={(end) => replace(index, { ...band, end })}
              placeholder="22:00"
            />
            <Field
              id={`band-${index}-price`}
              label={`Per kWh (${minor})`}
              value={band.price}
              onChange={(price) => replace(index, { ...band, price })}
              placeholder="2200"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onChange(bands.filter((_, at) => at !== index))}
              aria-label={`Remove band ${index + 1}`}
            >
              <TrashIcon />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {DAY_NAMES.map((name, day) => {
              const picked = band.days.includes(day + 1);
              return (
                <Button
                  key={name}
                  type="button"
                  size="xs"
                  variant={picked ? 'secondary' : 'outline'}
                  aria-pressed={picked}
                  onClick={() =>
                    replace(index, {
                      ...band,
                      days: picked
                        ? band.days.filter((value) => value !== day + 1)
                        : [...band.days, day + 1],
                    })
                  }
                >
                  {name}
                </Button>
              );
            })}
          </div>
        </div>
      ))}

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...bands, { ...EMPTY_BAND }])}
      >
        <PlusIcon />
        Add a band
      </Button>
    </div>
  );
}
