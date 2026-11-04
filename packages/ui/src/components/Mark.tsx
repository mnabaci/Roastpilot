import { useId } from 'react';
import { cn } from '../lib/utils';
import { BEAN_PATH, BEAN_TURN, CUT_PATH } from './mark-paths';

export interface MarkProps {
  /** Shows "Roastpilot" after the mark, as in the top bar. */
  withName?: boolean;
  className?: string;
}

/**
 * The Roastpilot mark: a dark coffee bean on an ember tile, its cut running end to end (design
 * system, Mark). Decoration only; the name is the text.
 */
export function Mark({ withName = false, className }: MarkProps) {
  const clip = useId();
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 64 64" aria-hidden="true" className="size-6 shrink-0">
        <defs>
          <clipPath id={clip}>
            <path d={BEAN_PATH} />
          </clipPath>
        </defs>
        <rect width="64" height="64" rx="16" className="fill-heat-fill" />
        <g transform={BEAN_TURN}>
          <path d={BEAN_PATH} className="fill-bg" />
          <path
            d={CUT_PATH}
            clipPath={`url(#${clip})`}
            className="fill-none stroke-heat-fill"
            strokeWidth={4.2}
            strokeLinecap="round"
          />
        </g>
      </svg>
      {withName ? <span className="text-heading text-ink">Roastpilot</span> : null}
    </span>
  );
}
