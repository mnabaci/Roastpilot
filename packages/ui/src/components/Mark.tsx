import { useId } from 'react';
import { cn } from '../lib/utils';

export interface MarkProps {
  /** Shows "Roastpilot" after the mark, as in the top bar. */
  withName?: boolean;
  className?: string;
}

/**
 * The Roastpilot mark: drum arcs on an ember tile, with one block of air (design system, Mark).
 * Decoration only; the name is the text.
 */
export function Mark({ withName = false, className }: MarkProps) {
  const clip = useId();
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 64 64" aria-hidden="true" className="size-6 shrink-0">
        <defs>
          <clipPath id={clip}>
            <rect width="64" height="64" rx="16" />
          </clipPath>
        </defs>
        <rect width="64" height="64" rx="16" className="fill-heat-fill" />
        <g clipPath={`url(#${clip})`} className="fill-none stroke-bg" strokeWidth={5.3}>
          <path d="M0 48 A16 16 0 0 1 16 64" />
          <path d="M0 32 A32 32 0 0 1 32 64" />
          <path d="M0 16 A48 48 0 0 1 48 64" />
        </g>
        <rect x="44" y="8" width="13" height="13" rx="4" className="fill-air" />
      </svg>
      {withName ? <span className="text-heading text-ink">Roastpilot</span> : null}
    </span>
  );
}
