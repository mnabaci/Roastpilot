import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Ellipsis } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Button } from './Button';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  /** Deletes something: red text (`critical-text`), never a red fill. */
  destructive?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  /** Names the "⋯" button for screen readers, e.g. "More for Light · Steps". */
  label: string;
  items: readonly MenuItem[];
  className?: string;
}

/**
 * The actions you rarely need, behind a "⋯" button (design system: Menu). Arrows move, Enter picks,
 * Escape closes and focus goes back to the button.
 */
export function Menu({ label, items, className }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={label}
          icon={<Ellipsis aria-hidden="true" />}
          className={className}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 flex min-w-48 flex-col gap-0.5 rounded-lg border border-border-strong bg-surface-raised p-1"
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cn(
                'flex h-control-sm cursor-pointer items-center gap-2 rounded-md px-3 text-body outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-surface-hover [&_svg]:size-5',
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
