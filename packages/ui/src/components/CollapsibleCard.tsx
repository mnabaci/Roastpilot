import { ChevronDown } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from '../lib/utils';

export interface CollapsibleCardProps {
  /** The card's name, on its header row. */
  title: string;
  /** One line of what's inside, shown on the header row while folded. */
  summary?: string | undefined;
  /** Said instead of `summary` by screen readers, where its symbols don't read well (★★★★★). */
  spokenSummary?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

/**
 * A card whose content folds away under its header row, which then sums it up in one line
 * (design system: CollapsibleCard). The screen keeps whether it is open.
 */
export function CollapsibleCard({
  title,
  summary,
  spokenSummary,
  open,
  onOpenChange,
  children,
  className,
}: CollapsibleCardProps) {
  const contentId = useId();
  const titleId = useId();
  const summaryId = useId();
  const folded = !open && summary !== undefined && summary !== '';
  return (
    <section
      aria-labelledby={titleId}
      className={cn('flex flex-col rounded-xl bg-surface', className)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        aria-labelledby={titleId}
        aria-describedby={folded ? summaryId : undefined}
        onClick={() => {
          onOpenChange(!open);
        }}
        className="flex min-h-control-sm w-full items-center gap-3 rounded-xl px-5 py-2 text-left hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <span id={titleId} className="shrink-0 text-heading text-ink">
          {title}
        </span>
        {folded ? (
          <>
            <span
              aria-hidden="true"
              className="min-w-0 flex-1 truncate text-label text-ink-muted tabular-nums"
            >
              {summary}
            </span>
            <span id={summaryId} className="sr-only">
              {spokenSummary ?? summary}
            </span>
          </>
        ) : (
          <span className="flex-1" />
        )}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-5 shrink-0 text-ink-muted transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      <div id={contentId} hidden={!open} className="flex flex-col gap-3 px-5 pb-4.5">
        {open ? children : null}
      </div>
    </section>
  );
}
