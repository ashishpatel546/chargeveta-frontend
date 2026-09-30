'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * The dashboards' charts (doc 7 §7), drawn from the API's series — never a
 * chart-shaped response — so a table and a CSV of the same rows always agree.
 *
 * Colours are the theme's `--chart-*` slots, stepped separately for dark mode
 * in `globals.css`. Every figure also has a text form (a tooltip, a label or
 * the table beside it), so none is read from colour alone.
 */

export function ChartCard({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export interface ColumnDatum {
  key: string;
  /** The tick under the column. */
  tick: string;
  /** The tooltip's heading. */
  title: string;
  value: number;
  /** The value as the tooltip shows it, formatted by the caller. */
  display: string;
}

/**
 * A column per bucket over time. Columns rather than a line: a line implies
 * continuity between days that a bar does not (doc 7 §7), and an empty day is
 * a zero-height column, not a slope.
 */
export function ColumnChart({
  data,
  color = 'var(--chart-1)',
  height = 240,
  formatAxis,
}: {
  data: ColumnDatum[];
  color?: string;
  height?: number;
  formatAxis?: (value: number) => string;
}) {
  return (
    // ResponsiveContainer measures its parent, which must have a real height.
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="2 2"
          />
          <XAxis
            dataKey="tick"
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            minTickGap={12}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickFormatter={formatAxis}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
            content={({ active, payload }) => {
              const datum = payload?.[0]?.payload as ColumnDatum | undefined;
              if (!active || !datum) return null;
              return (
                <div className="bg-popover text-popover-foreground rounded-md border px-2.5 py-1.5 text-xs shadow-md">
                  <p className="font-medium">{datum.title}</p>
                  <p className="text-muted-foreground">{datum.display}</p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="value"
            fill={color}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface RankedDatum {
  key: string;
  label: string;
  sub?: string;
  value: number;
  display: string;
}

/**
 * A ranked horizontal bar per group — "where does it come from?" — with the
 * label and the figure written out beside each bar. Not a pie: ranking beats
 * angle-comparison at every count above three (doc 7 §7). One hue: it is
 * magnitude, not identity.
 */
export function RankedBars({
  rows,
  color = 'var(--chart-1)',
  limit = 10,
  empty = 'Nothing in this period.',
}: {
  rows: RankedDatum[];
  color?: string;
  limit?: number;
  empty?: string;
}) {
  const shown = [...rows].sort((a, b) => b.value - a.value).slice(0, limit);
  const max = Math.max(0, ...shown.map((row) => row.value));
  if (shown.length === 0 || max === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">{empty}</p>;
  }
  return (
    <ul className="space-y-2.5">
      {shown.map((row) => (
        <li key={row.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {row.label}
              {row.sub ? (
                <span className="text-muted-foreground ml-1.5 text-xs">
                  {row.sub}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 tabular-nums">{row.display}</span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (row.value / max) * 100)}%`,
                backgroundColor: color,
              }}
            />
          </div>
        </li>
      ))}
      {rows.length > limit ? (
        <li className="text-muted-foreground text-xs">
          and {rows.length - limit} more — see the table.
        </li>
      ) : null}
    </ul>
  );
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * When the network is busy: sessions by local hour and weekday. The single
 * most actionable operator chart, and the one a line chart hides entirely
 * (doc 7 §7). One hue, more is darker; each cell names its count on hover
 * and to a screen reader, so the shade is never the only way to read it.
 */
export function HourWeekHeatmap({
  cells,
}: {
  cells: { weekday: number; hour: number; sessions: number }[];
}) {
  const byCell = new Map(cells.map((c) => [`${c.weekday}:${c.hour}`, c.sessions]));
  const max = Math.max(0, ...cells.map((c) => c.sessions));
  if (max === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        No sessions in this period.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {/* Scrolls inside the card at phone width rather than the page. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-[2px] text-[10px]">
          <thead>
            <tr>
              <th className="w-9" />
              {Array.from({ length: 24 }, (_, hour) => (
                <th
                  key={hour}
                  scope="col"
                  className="text-muted-foreground font-normal"
                >
                  {hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((name, index) => (
              <tr key={name}>
                <th
                  scope="row"
                  className="text-muted-foreground pr-1 text-left font-normal"
                >
                  {name}
                </th>
                {Array.from({ length: 24 }, (_, hour) => {
                  const sessions = byCell.get(`${index + 1}:${hour}`) ?? 0;
                  const label = `${name} ${String(hour).padStart(2, '0')}:00 — ${sessions} session${sessions === 1 ? '' : 's'}`;
                  return (
                    <td
                      key={hour}
                      title={label}
                      aria-label={label}
                      className="bg-muted h-5 rounded-[3px]"
                      style={
                        sessions > 0
                          ? {
                              backgroundColor: `color-mix(in oklab, var(--chart-1) ${Math.round(
                                15 + (sessions / max) * 85,
                              )}%, transparent)`,
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <span>Fewer</span>
        {[15, 36, 57, 78, 100].map((step) => (
          <span
            key={step}
            className="size-3 rounded-[3px]"
            style={{
              backgroundColor: `color-mix(in oklab, var(--chart-1) ${step}%, transparent)`,
            }}
          />
        ))}
        <span>More (up to {max})</span>
        <span className="ml-auto">Local time at each site</span>
      </div>
    </div>
  );
}

/** Segmented buttons for choosing what the charts show. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="bg-muted inline-flex rounded-lg p-[3px]"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={
            value === option.value
              ? 'bg-background text-foreground rounded-md px-2.5 py-1 text-xs font-medium shadow-sm'
              : 'text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1 text-xs'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
