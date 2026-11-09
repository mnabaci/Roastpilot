import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Ellipsis } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Button } from './Button';
import { DROPDOWN_PANEL, DROPDOWN_ROW } from './dropdown-panel';
import { Tooltip } from './Tooltip';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  /** Deletes something: red text (`critical-text`), never a red fill. */
  destructive?: boolean;
  disabled?: boolean;
  /** Why a disabled item can't be picked now ("Disconnect first"): a tooltip, and its description. */
  hint?: string;
}

export interface MenuProps {
  /** Names the "⋯" button for screen readers, e.g. "More for Light · Steps"; with `text`, its words. */
  label: string;
  /** A worded button with a chevron ("Make profile ▾") instead of "⋯". */
  text?: string;
  items: readonly MenuItem[];
  /** The trigger waits, dimmed (Export before anything is ticked). */
  disabled?: boolean;
  className?: string;
}

/**
 * The actions you rarely need, behind a "⋯" button (design system: Menu). Arrows move, Enter picks,
 * Escape closes and focus goes back to the button.
 */
export function Menu({ label, text, items, disabled, className }: MenuProps) {
  const hintId = useId();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        {text ? (
          <Button
            size="sm"
            // Same chip as FilterSelect ("Compare ▾" beside "Make profile ▾"): 16 px chevron, tight gap.
            className={cn('flex-row-reverse gap-1 px-2.5 [&_svg]:size-4', className)}
            icon={<ChevronDown aria-hidden="true" />}
          >
            {/* Truncates when a header row is tight and the button is allowed to shrink. */}
            <span className="truncate">{text}</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            aria-label={label}
            icon={<Ellipsis aria-hidden="true" />}
            className={className}
          />
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className={cn(DROPDOWN_PANEL, 'min-w-48')}>
          {items.map((item, index) => {
            // The reason describes the item; its name stays the label.
            const hint = item.hint ? `${hintId}-${String(index)}` : undefined;
            const row = (
              <DropdownMenu.Item
                key={item.label}
                // Not Radix's disabled: that skips the item on the arrow keys, and its reason with
                // it. A waiting item stays focusable, says so, and does nothing.
                aria-disabled={item.disabled ? true : undefined}
                onSelect={(event) => {
                  if (item.disabled) {
                    event.preventDefault();
                    return;
                  }
                  item.onSelect();
                }}
                aria-label={hint ? item.label : undefined}
                aria-describedby={hint}
                className={cn(
                  DROPDOWN_ROW,
                  'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:size-5',
                  item.destructive ? 'text-critical-text' : 'text-ink',
                )}
              >
                {item.icon}
                {item.label}
                {hint ? (
                  <span id={hint} className="sr-only">
                    {item.hint}
                  </span>
                ) : null}
              </DropdownMenu.Item>
            );
            return item.hint ? (
              <Tooltip key={item.label} content={item.hint} side="left">
                {row}
              </Tooltip>
            ) : (
              row
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
