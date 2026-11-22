import * as Popover from '@radix-ui/react-popover';
import { Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { DROPDOWN_PANEL } from './dropdown-panel';

export interface InfoButtonProps {
  /** What it explains, as the button's name: "About tasting words". */
  label: string;
  /** A few short lines, each its own paragraph: the first says what it is, in ink; the rest quieter. */
  lines: readonly string[];
  className?: string;
}

/**
 * A small ⓘ beside a name that opens a short explanation on click (design system: InfoButton):
 * for what a one-line hint can't say. Not a Tooltip, which only finishes cut-off text: this one
 * takes focus, stays open while you read and closes with Escape or a click away.
 */
export function InfoButton({ label, lines, className }: InfoButtonProps) {
  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        aria-label={label}
        className={cn(
          'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-focus data-[state=open]:text-ink',
          className,
        )}
      >
        <Info aria-hidden="true" className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          side="bottom"
          sideOffset={4}
          collisionPadding={8}
          aria-label={label}
          className={cn(DROPDOWN_PANEL, 'w-96 gap-2 px-4 py-3')}
        >
          {lines.map((line, i) => (
            <p key={line} className={cn('text-label', i === 0 ? 'text-ink' : 'text-ink-muted')}>
              {line}
            </p>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
