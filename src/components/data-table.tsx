'use client';

import {
  SlidersHorizontalIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * The pieces every list screen shares: a sortable column header, a pager,
 * filters kept in the URL, and — for the lists the API returns whole — the
 * sorting and paging done here.
 */

export type Direction = 'asc' | 'desc';

export interface SortState<K extends string> {
  column: K;
  direction: Direction;
}

/**
 * The next sort after a header is clicked: the same column flips, another
 * starts at `firstDirection` (newest, largest or A–Z first, as the column
 * reads most usefully).
 */
export function nextSort<K extends string>(
  current: SortState<K>,
  column: K,
  firstDirection: Direction = 'desc',
): SortState<K> {
  if (current.column === column) {
    return {
      column,
      direction: current.direction === 'desc' ? 'asc' : 'desc',
    };
  }
  return { column, direction: firstDirection };
}

/** A column header that sorts the list by itself, and says how it is sorted. */
export function SortableHead<K extends string>({
  label,
  column,
  sort,
  onSort,
  firstDirection = 'desc',
  className,
}: {
  label: string;
  column: K;
  sort: SortState<K>;
  onSort: (next: SortState<K>) => void;
  firstDirection?: Direction;
  className?: string;
}) {
  const active = sort.column === column;
  const Icon = !active
    ? ArrowUpDownIcon
    : sort.direction === 'desc'
      ? ArrowDownIcon
      : ArrowUpIcon;
  return (
    <TableHead
      className={className}
      aria-sort={
        active
          ? sort.direction === 'desc'
            ? 'descending'
            : 'ascending'
          : 'none'
      }
    >
      <button
        type="button"
        onClick={() => onSort(nextSort(sort, column, firstDirection))}
        className={cn(
          '-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
          !active && 'text-muted-foreground',
        )}
      >
        {label}
        <Icon className="size-3.5" aria-hidden />
      </button>
    </TableHead>
  );
}

export const PAGE_SIZES = [25, 50, 100] as const;

/**
 * Where a list is, and the way to the next and previous pages.
 *
 * `capped` says `total` is a lower bound — the API stops counting at some
 * point, and the pager then says "10,000+" rather than pretend.
 */
export function Pager({
  page,
  pageSize,
  total,
  capped = false,
  onPage,
  onPageSize,
  busy = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  capped?: boolean;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  busy?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const count = `${total.toLocaleString('en-IN')}${capped ? '+' : ''}`;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground" aria-live="polite">
        {total === 0
          ? 'Nothing to show'
          : `${first.toLocaleString('en-IN')}–${last.toLocaleString('en-IN')} of ${count}`}
      </p>
      <div className="flex items-center gap-2">
        {onPageSize ? (
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSize(Number(value ?? pageSize))}
            items={PAGE_SIZES.map((size) => ({
              value: String(size),
              label: `${size} a page`,
            }))}
          >
            <SelectTrigger aria-label="Rows a page" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} a page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={busy || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="text-muted-foreground min-w-24 text-center tabular-nums">
          Page {page} of {pages.toLocaleString('en-IN')}
          {capped ? '+' : ''}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={busy || page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}

/**
 * State kept in the page's query string, so a filtered list survives opening
 * a row and coming back, and can be shared as a link.
 *
 * `defaults` are left out of the URL: a list with nothing changed has a clean
 * address. Writes replace the history entry rather than adding one, so Back
 * leaves the list instead of undoing each keystroke.
 *
 * The screen using it has to be under a `<Suspense>` boundary.
 */
export function useUrlState<T extends Record<string, string>>(
  defaults: T,
): [T, (changes: Partial<T>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // `defaults` is a fresh object every render; its values are what matter.
  const defaultsKey = JSON.stringify(defaults);

  const state = useMemo(() => {
    const read = JSON.parse(defaultsKey) as T;
    for (const key of Object.keys(read) as (keyof T & string)[]) {
      const value = params.get(key);
      if (value !== null) read[key] = value as T[typeof key];
    }
    return read;
  }, [params, defaultsKey]);

  const update = useCallback(
    (changes: Partial<T>) => {
      const base = JSON.parse(defaultsKey) as T;
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === base[key]) next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router, defaultsKey],
  );

  return [state, update];
}

/** `value`, once it has stopped changing for `ms` — for a search box. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * Sorting and paging for a list the API returns whole (chargers, sites).
 *
 * Done here because those lists are small and already in the browser for
 * every other screen that names a charger or a site; asking the API again
 * per page would cost more than it saves. `sorters` maps a column to the
 * value it sorts by — text compares by locale, numbers and dates as numbers,
 * and a missing value goes last either way.
 */
export function useClientTable<T, K extends string>(
  rows: readonly T[],
  sort: SortState<K>,
  sorters: Record<K, (row: T) => string | number | null | undefined>,
  page: number,
  pageSize: number,
) {
  const sorted = useMemo(() => {
    const key = sorters[sort.column];
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = key(a);
      const y = key(b);
      const xMissing = x === null || x === undefined || x === '';
      const yMissing = y === null || y === undefined || y === '';
      if (xMissing || yMissing)
        return xMissing === yMissing ? 0 : xMissing ? 1 : -1;
      if (typeof x === 'number' && typeof y === 'number') return sign * (x - y);
      return (
        sign *
        String(x).localeCompare(String(y), 'en-IN', {
          numeric: true,
          sensitivity: 'base',
        })
      );
    });
    // `sorters` is a fresh object every render; the column picks the function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort.column, sort.direction]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  // A filter that shrinks the list can leave the page past its end.
  const current = Math.min(page, pages);
  return {
    page: current,
    total: sorted.length,
    sorted,
    pageRows: sorted.slice((current - 1) * pageSize, current * pageSize),
  };
}

/**
 * Rows already in the browser as a CSV file — for the lists the API returns
 * whole, so an export reads nothing more from the server.
 *
 * The same rules as the API's own CSV: RFC 4180 quoting, and a text field
 * starting with `=`, `+`, `-` or `@` prefixed with an apostrophe, because an
 * operator-entered name opened in a spreadsheet would otherwise run as a
 * formula.
 */
export function downloadRowsCsv<T>(
  filename: string,
  columns: {
    header: string;
    value: (row: T) => string | number | null | undefined;
  }[],
  rows: readonly T[],
): void {
  const field = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    let text = String(value);
    if (!/^-?\d+(\.\d+)?$/.test(text) && /^[=+\-@]/.test(text))
      text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.map((column) => field(column.header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => field(column.value(row))).join(','));
  }
  const blob = new Blob([`${lines.join('\r\n')}\r\n`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * A list's filter dropdowns: inline from tablet up, and on a phone folded
 * behind one "Filters" button (with how many are set), so the list itself
 * starts on the first screen instead of under four full-width selects.
 */
export function FilterDisclosure({
  active,
  children,
}: {
  /** How many of the filters inside are set to something other than "any". */
  active: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={active > 0 ? 'secondary' : 'outline'}
        className="md:hidden"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontalIcon data-icon="inline-start" />
        Filters
        {active > 0 ? (
          <span className="bg-primary text-primary-foreground ml-0.5 rounded-full px-1.5 text-[11px] leading-4 tabular-nums">
            {active}
          </span>
        ) : null}
      </Button>
      <div
        className={cn(
          open ? 'grid' : 'hidden',
          'w-full grid-cols-1 gap-2 md:flex md:w-auto md:flex-wrap md:items-center',
        )}
      >
        {children}
      </div>
    </>
  );
}
