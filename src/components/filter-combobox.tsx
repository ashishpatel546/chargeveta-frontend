'use client';

import { Combobox } from '@base-ui/react/combobox';
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from 'lucide-react';
import { cn } from 'cn';

export interface FilterItem {
  value: string;
  label: string;
}

/**
 * A list filter you type into: the box narrows its choices as you type, and
 * picking one applies it. Every list screen's filters use this one control,
 * so a list of 500 chargers or sites is searched rather than scrolled, and a
 * three-choice filter behaves the same as a long one.
 *
 * `allValue` is the "no filter" choice (by convention `'all'`). It is not
 * shown as a choice: an empty box means it, its label is the placeholder, and
 * the clear button returns to it.
 */
export function FilterCombobox({
  value,
  onChange,
  items,
  label,
  id,
  allValue = 'all',
  className = 'w-56',
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Every choice, the "no filter" one (`allValue`) included or not. */
  items: readonly FilterItem[];
  /** The filter's name, for screen readers when there is no visible label. */
  label: string;
  id?: string;
  allValue?: string;
  className?: string;
  disabled?: boolean;
}) {
  const everything = items.find((item) => item.value === allValue);
  const choices = items.filter((item) => item.value !== allValue);
  const selected =
    value === allValue
      ? null
      : (choices.find((item) => item.value === value) ?? null);

  return (
    <Combobox.Root<FilterItem>
      items={choices}
      value={selected}
      onValueChange={(item) => onChange(item?.value ?? allValue)}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      disabled={disabled}
    >
      <Combobox.InputGroup
        className={cn(
          'border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 relative flex h-8 items-center rounded-lg border bg-transparent transition-colors focus-within:ring-3 data-disabled:opacity-50',
          className,
        )}
      >
        <SearchIcon
          className="text-muted-foreground pointer-events-none absolute left-2.5 size-4"
          aria-hidden
        />
        <Combobox.Input
          id={id}
          aria-label={label}
          placeholder={everything?.label ?? `Any ${label.toLowerCase()}`}
          className="placeholder:text-muted-foreground h-full w-full min-w-0 truncate bg-transparent pr-14 pl-8 text-base outline-none md:text-sm"
        />
        <div className="text-muted-foreground absolute right-1 flex items-center">
          {selected ? (
            <Combobox.Clear
              aria-label={`Clear ${label.toLowerCase()}`}
              className="hover:text-foreground flex size-6 items-center justify-center rounded-md"
            >
              <XIcon className="size-3.5" />
            </Combobox.Clear>
          ) : null}
          <Combobox.Trigger
            aria-label={`Show every ${label.toLowerCase()} choice`}
            className="hover:text-foreground flex size-6 items-center justify-center rounded-md"
          >
            <ChevronDownIcon className="size-4" />
          </Combobox.Trigger>
        </div>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner className="isolate z-50" sideOffset={4}>
          <Combobox.Popup className="bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 w-(--anchor-width) max-w-(--available-width) min-w-44 origin-(--transform-origin) rounded-lg shadow-md ring-1 duration-100">
            <Combobox.Empty>
              <p className="text-muted-foreground px-3 py-2.5 text-sm">
                Nothing matches.
              </p>
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(20rem,var(--available-height))] scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none data-empty:p-0">
              {(item: FilterItem) => (
                <Combobox.Item
                  key={item.value}
                  value={item}
                  className="data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-none select-none"
                >
                  <span className="truncate">{item.label}</span>
                  <Combobox.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
                    <CheckIcon className="size-4" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
