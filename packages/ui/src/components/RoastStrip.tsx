import { ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export interface RoastStripNumber {
  label: string;
  /** Formatted, with its unit; undefined shows a dash. */
  value: string | undefined;
}

export interface RoastStripProps {
  /** The phase and its clock, e.g. "Roasting · 7:42". */
  lead: string;
  /** A real prompt from the flow ("Dump beans · Cooling 3:58 left"); leads, highlighted. */
  prompt?: string;
  numbers: readonly RoastStripNumber[];
  /** Opens the Roast screen. */
  onOpen: () => void;
  className?: string;
}

/**
 * A slim row on the other screens while a roast runs: does anything need me? (design system,
 * RoastStrip). The whole row opens Roast.
 */
export function RoastStrip({ lead, prompt, numbers, onOpen, className }: RoastStripProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex h-control-sm w-full items-center gap-4 overflow-hidden border-b border-border px-6 text-left whitespace-nowrap tabular-nums focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        // Ember: a roast is heating. Brighter still when something needs you.
        'bg-heat-tint hover:brightness-110',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full bg-heat motion-safe:animate-pulse"
      />
      <span className={cn('shrink-0 text-body text-heat', prompt ? 'font-bold' : 'font-semibold')}>
        {prompt ?? lead}
      </span>
      <span className="flex min-w-0 gap-4 truncate">
        {numbers.map(({ label, value }) => (
          <span key={label} className="text-label text-ink-muted">
            {label} <span className="font-medium text-ink">{value ?? '–'}</span>
          </span>
        ))}
      </span>
      <ChevronRight aria-hidden="true" className="ml-auto size-5 shrink-0 text-ink-muted" />
    </button>
  );
}
