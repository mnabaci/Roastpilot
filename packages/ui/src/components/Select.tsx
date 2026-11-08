import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Check, Search } from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Badge } from './Badge';
import { DROPDOWN_PANEL, DROPDOWN_ROW } from './dropdown-panel';

export interface SelectOption<V extends string> {
  value: V;
  label: string;
  /** One quieter line under the name that helps you choose: "300 g · Ethiopia · washed". */
  detail?: string;
  /** A short state at the row's end, as a neutral Badge: "Needs calibration". Never truncated. */
  badge?: string;
  disabled?: boolean;
}

export interface SelectProps<V extends string> {
  /** Names the list (and its search) for screen readers: "Bean". */
  label: string;
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (value: V) => void;
  /** What the button shows: the field's value and chevron, or a filter chip's text. */
  children: ReactNode;
  /** The button's look; SelectField and FilterSelect give it theirs. */
  className?: string;
  id?: string;
  /** The button's name when no `<label>` names it, e.g. "Bean: Ethiopia Guji". */
  'aria-label'?: string;
  disabled?: boolean;
  /** Which edge of the button the panel lines up with. */
  align?: 'start' | 'end';
}

/** Longer lists than this start with a search box (docs/spec/ui.md, Dropdowns). */
export const SEARCH_FROM = 9;

const words = (option: SelectOption<string>) =>
  [option.label, option.detail ?? '', option.badge ?? ''].join(' ').toLowerCase();

/**
 * Pick one of a list in the app's own panel, never the system popup (design system: Select). Arrows
 * move, Enter picks, Escape closes and focus goes back to the button; a letter jumps to the first
 * option starting with it; a list longer than 8 searches by name and detail.
 */
export function Select<V extends string>({
  label,
  value,
  options,
  onChange,
  children,
  className,
  id,
  'aria-label': ariaLabel,
  disabled = false,
  align = 'start',
}: SelectProps<V>) {
  const [open, setOpen] = useState(false);
  // The option under the keyboard; cmdk shows it highlighted.
  const [active, setActive] = useState<string>(value);
  const list = useRef<HTMLDivElement>(null);
  const searchable = options.length >= SEARCH_FROM;
  const pick = (next: V) => {
    setOpen(false);
    if (next !== value) onChange(next);
  };
  // Without a search box, a letter jumps to the first option starting with it.
  const jump = (event: KeyboardEvent) => {
    if (searchable || event.key.length !== 1 || !/\S/.test(event.key)) return;
    const key = event.key.toLowerCase();
    const match = options.find((o) => !o.disabled && o.label.toLowerCase().startsWith(key));
    if (match) setActive(match.value);
    event.preventDefault();
  };
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setActive(value);
        setOpen(next);
      }}
    >
      <Popover.Trigger
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={className}
      >
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={4}
          collisionPadding={8}
          className={cn(DROPDOWN_PANEL, 'w-(--radix-popover-trigger-width) min-w-48')}
          onOpenAutoFocus={(event) => {
            // With no search box, the list itself takes the keys.
            if (searchable) return;
            event.preventDefault();
            list.current?.focus();
          }}
        >
          <Command
            ref={list}
            tabIndex={-1}
            // cmdk names its search box with this.
            label={`Search ${label}`}
            value={active}
            onValueChange={setActive}
            onKeyDown={jump}
            filter={(optionValue, search) => {
              const option = options.find((o) => o.value === optionValue);
              return option && words(option).includes(search.toLowerCase().trim()) ? 1 : 0;
            }}
            className="flex min-h-0 flex-col outline-none"
          >
            {searchable ? (
              <div className="-m-1 mb-0.5 flex h-control-sm items-center gap-2 border-b border-border px-3">
                <Search aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
                <Command.Input
                  placeholder="Search…"
                  className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-muted"
                />
              </div>
            ) : null}
            <Command.List label={label} className="max-h-96 overflow-y-auto">
              <Command.Empty className="flex min-h-control-sm items-center px-3 text-body text-ink-muted">
                No match
              </Command.Empty>
              {options.map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  onSelect={() => {
                    pick(option.value);
                  }}
                  className={DROPDOWN_ROW}
                >
                  <Check
                    aria-hidden="true"
                    className={cn('size-4 shrink-0', option.value === value ? '' : 'invisible')}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-ink">{option.label}</span>
                    {option.detail ? (
                      <span className="truncate text-label text-ink-muted">{option.detail}</span>
                    ) : null}
                  </span>
                  {option.badge ? <Badge className="shrink-0">{option.badge}</Badge> : null}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
