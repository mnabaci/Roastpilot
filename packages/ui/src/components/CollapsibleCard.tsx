import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Tooltip } from './Tooltip';

/** How long folding and opening take (globals.css, `.collapse-panel`). */
const COLLAPSE_MS = 150;

export interface CollapsibleCardProps {
  /** The card's name, on its header row. A node when the row says more (Roast's setup line). */
  title: ReactNode;
  /** One line of what's inside, shown on the header row while folded. */
  summary?: string | undefined;
  /** Said instead of `summary` by screen readers, where its symbols don't read well (★★★★★). */
  spokenSummary?: string | undefined;
  /** Names the header button when `title` isn't plain words ("Change setup"). */
  label?: string;
  /** The whole header in the app's Tooltip, when the title is cut short (Roast's setup line). */
  tooltip?: string | undefined;
  /** A control of its own on the header row, before the chevron (Roast's Auto switch). */
  action?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

/**
 * A card whose content folds away under its header row, which then sums it up in one line
 * (design system: CollapsibleCard). The whole row folds and opens, except its own `action`; the
 * screen keeps whether it is open.
 */
export function CollapsibleCard({
  title,
  summary,
  spokenSummary,
  label,
  action,
  tooltip,
  open,
  onOpenChange,
  children,
  className,
}: CollapsibleCardProps) {
  const contentId = useId();
  const titleId = useId();
  const summaryId = useId();
  const folded = !open && summary !== undefined && summary !== '';
  // Opening, it mounts and grows from nothing (CSS @starting-style); closing, it shrinks, then
  // goes once it has.
  const [mounted, setMounted] = useState(open);
  // Opened: it stays mounted from now, so folding can animate it out.
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) return undefined;
    const timer = setTimeout(() => {
      setMounted(false);
    }, COLLAPSE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [open]);
  const toggle = () => {
    onOpenChange(!open);
  };
  const button = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={contentId}
      aria-label={label}
      aria-labelledby={label ? undefined : titleId}
      aria-describedby={folded ? summaryId : undefined}
      onClick={toggle}
      className={cn(
        'flex min-h-control-sm min-w-0 flex-1 items-center gap-3 rounded-md px-2 text-left after:absolute after:inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        open ? 'after:rounded-t-xl' : 'after:rounded-xl',
      )}
    >
      <span id={titleId} className={cn('min-w-0 text-heading text-ink', folded && 'shrink-0')}>
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
      ) : null}
    </button>
  );
  return (
    <section
      // With a `label`, the screen names the region itself.
      aria-labelledby={label ? undefined : titleId}
      className={cn('flex flex-col rounded-xl bg-surface', className)}
    >
      {/* The button stretches over the whole row (its ::after), so any of the row folds and
          opens; the action sits above it and keeps its own clicks. */}
      <div
        className={cn(
          'group relative flex min-h-control-sm items-center gap-3 py-2 pr-5 pl-3 hover:bg-surface-hover',
          // Open, the hover stays the top of the card instead of a bar of its own.
          open ? 'rounded-t-xl' : 'rounded-xl',
        )}
      >
        {tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button}
        {action ? <div className="relative flex shrink-0 items-center gap-2">{action}</div> : null}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-5 shrink-0 text-ink-muted transition-transform group-hover:text-ink',
            open && 'rotate-180',
          )}
        />
      </div>
      {mounted || open ? (
        <div
          id={contentId}
          className="collapse-panel"
          data-open={open ? '' : undefined}
          // Closing, it is already gone for keys and screen readers.
          inert={!open}
          aria-hidden={open ? undefined : true}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-3 px-5 pt-3 pb-5">{children}</div>
          </div>
        </div>
      ) : (
        <div id={contentId} hidden />
      )}
    </section>
  );
}
