import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Ellipsis } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Button } from './Button';
import { DROPDOWN_PANEL, DROPDOWN_ROW } from './dropdown-panel';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  /** Deletes something: red text (`critical-text`), never a red fill. */
  destructive?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  /** Names the "⋯" button for screen readers, e.g. "More for Light · Steps"; with `text`, its words. */
  label: string;
  /** A worded button with a chevron ("Make profile ▾") instead of "⋯". */
  text?: string;
  items: readonly MenuItem[];
  className?: string;
}

/**
 * The actions you rarely need, behind a "⋯" button (design system: Menu). Arrows move, Enter picks,
 * Escape closes and focus goes back to the button.
 */
export function Menu({ label, text, items, className }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {text ? (
          <Button
            size="sm"
            // Same chip as FilterSelect ("Compare ▾" beside "Make profile ▾"): 16 px chevron, tight gap.
            className={cn('flex-row-reverse gap-1 px-3 [&_svg]:size-4', className)}
            icon={<ChevronDown aria-hidden="true" />}
          >
            {text}
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
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cn(
                DROPDOWN_ROW,
                'data-disabled:cursor-not-allowed data-disabled:opacity-50 [&_svg]:size-5',
                item.destructive ? 'text-critical-text' : 'text-ink',
              )}
            >
              {item.icon}
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
