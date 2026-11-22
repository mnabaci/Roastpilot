import * as RadixPopover from '@radix-ui/react-popover';
import { useRef, type ReactElement, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { DROPDOWN_PANEL } from './dropdown-panel';

export interface PopoverProps {
  /** The button that opens it; it gets the open state and the panel's id. */
  trigger: ReactElement;
  /** Names the panel for screen readers: "Green Coffee Collective", "About tasting words". */
  label: string;
  children: ReactNode;
  /** The panel's width and spacing; 320px with 16px padding unless you say. */
  className?: string;
}

/**
 * A small panel that opens from a button, on click (design system: Popover): a short read of
 * something named on the page, with at most one action. It takes focus, stays open while you read
 * and closes with Escape or a click away, focus going back to its button. Not a Dialog, which
 * holds a task; not a Tooltip, which only finishes cut-off text.
 */
export function Popover({ trigger, label, children, className }: PopoverProps) {
  const panel = useRef<HTMLDivElement>(null);
  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align="start"
          side="bottom"
          sideOffset={4}
          collisionPadding={8}
          aria-label={label}
          // Focus goes to the panel, not its first button: no ring on open, Tab reaches the rest.
          ref={panel}
          tabIndex={-1}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            panel.current?.focus();
          }}
          className={cn(DROPDOWN_PANEL, 'w-80 gap-3 p-4 outline-none', className)}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

/** Closes the Popover it's in when clicked, as its action does after it acts. */
export const PopoverClose = RadixPopover.Close;
