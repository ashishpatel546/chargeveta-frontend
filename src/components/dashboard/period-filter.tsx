'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PRESETS, presetPeriod, type Period, type PresetId } from '@/lib/period';

/**
 * A period: a preset, or two dates when "Custom" is picked. Picking a preset
 * fills in the dates, so switching to Custom starts from what was on screen.
 */
export function PeriodFilter({
  idPrefix,
  period,
  onChange,
}: {
  idPrefix: string;
  period: Period;
  onChange: (period: Period) => void;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-period`} className="text-xs">
          Period
        </Label>
        <Select
          value={period.preset}
          onValueChange={(value) => {
            const preset = (value as PresetId | null) ?? '30d';
            onChange(
              preset === 'custom'
                ? { ...period, preset }
                : presetPeriod(preset),
            );
          }}
        >
          <SelectTrigger id={`${idPrefix}-period`} className="w-40">
            <SelectValue>
              {(value: PresetId) =>
                PRESETS.find((p) => p.id === value)?.label ?? 'Period'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {period.preset === 'custom' ? (
        <>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-from`} className="text-xs">
              From
            </Label>
            <Input
              id={`${idPrefix}-from`}
              type="date"
              value={period.from}
              onChange={(event) =>
                onChange({ ...period, from: event.target.value })
              }
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-to`} className="text-xs">
              To
            </Label>
            <Input
              id={`${idPrefix}-to`}
              type="date"
              value={period.to}
              onChange={(event) =>
                onChange({ ...period, to: event.target.value })
              }
              className="w-40"
            />
          </div>
        </>
      ) : null}
    </>
  );
}
