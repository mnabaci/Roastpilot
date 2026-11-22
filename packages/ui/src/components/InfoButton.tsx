import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { cn } from '../lib/utils';
import { Popover, PopoverClose } from './Popover';

export interface InfoButtonProps {
  /** What it explains, as the button's name: "About tasting words". */
  label: string;
  /** A few short lines, each its own paragraph: the first says what it is, in ink; the rest quieter. */
  lines: readonly string[];
  /** One quiet way to read more after the lines (a bean's roast note: the cheat sheet). */
  more?: { label: string; icon?: ReactNode; onSelect: () => void } | undefined;
  className?: string;
}

/**
 * A small ⓘ beside a name that opens a short explanation on click (design system: InfoButton):
 * for what a one-line hint can't say. A Popover with a few lines; not a Tooltip, which only
 * finishes cut-off text.
 */
export function InfoButton({ label, lines, more, className }: InfoButtonProps) {
  return (
    <Popover
      label={label}
      className="w-96 gap-2 px-4 py-3"
      trigger={
        <button
          type="button"
          aria-label={label}
          className={cn(
            'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-focus data-[state=open]:text-ink',
            className,
          )}
        >
          <Info aria-hidden="true" className="size-4" />
        </button>
      }
    >
      {lines.map((line, i) => (
        <p key={line} className={cn('text-label', i === 0 ? 'text-ink' : 'text-ink-muted')}>
          {line}
        </p>
      ))}
      {more ? (
        <PopoverClose asChild>
          <Button
            size="sm"
            variant="ghost"
            // The icon lines up with the lines above.
            className="-mb-1 -ml-2 self-start px-2"
            icon={more.icon}
            onClick={more.onSelect}
          >
            {more.label}
          </Button>
        </PopoverClose>
      ) : null}
    </Popover>
  );
}
