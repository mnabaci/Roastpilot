import { Star } from 'lucide-react';
import { useId } from 'react';
import { cn } from '../lib/utils';

/** A rating is 1–5 stars. */
export const MAX_STARS = 5;
const STARS = Array.from({ length: MAX_STARS }, (_, i) => i + 1);

/** What a screen reader says for a rating: `Rated 4 of 5`, or `Not rated`. */
export function spokenRating(value: number | null | undefined): string {
  return value == null ? 'Not rated' : `Rated ${String(value)} of ${String(MAX_STARS)}`;
}

export interface StarRatingProps {
  /** 1–5, or none yet. */
  value: number | null | undefined;
  /**
   * Makes it a picker: a star sets that many; the chosen one again clears it. Without it, the
   * stars only show the rating.
   */
  onChange?: (value: number | null) => void;
  /** The picker's group name ("Rating"); a shown rating needs none. */
  label?: string;
  className?: string;
}

/**
 * A roast's rating as five stars (design system: StarRating): filled up to the rating, outlined
 * after. Shown, small and inline in a list or a table, with "–" for none; as a picker, five 44px
 * targets.
 */
export function StarRating({ value, onChange, label = 'Rating', className }: StarRatingProps) {
  const labelId = useId();
  if (!onChange) {
    if (value == null) {
      return (
        <span
          role="img"
          className={cn('text-ink-muted', className)}
          aria-label={spokenRating(value)}
        >
          –
        </span>
      );
    }
    return (
      <span
        role="img"
        aria-label={spokenRating(value)}
        className={cn('inline-flex shrink-0 items-center gap-px align-middle', className)}
      >
        {STARS.map((star) => (
          <Star
            key={star}
            aria-hidden="true"
            className={cn('size-3.5', star <= value ? 'text-ink' : 'text-border-strong')}
            fill={star <= value ? 'currentColor' : 'none'}
          />
        ))}
      </span>
    );
  }
  return (
    <div role="group" aria-labelledby={labelId} className={cn('flex items-center', className)}>
      <span id={labelId} className="sr-only">
        {label}
      </span>
      {STARS.map((star) => {
        const on = value != null && star <= value;
        return (
          <button
            key={star}
            type="button"
            aria-label={`${String(star)} ${star === 1 ? 'star' : 'stars'}`}
            aria-pressed={value === star}
            onClick={() => {
              onChange(value === star ? null : star);
            }}
            className="group flex size-control-sm items-center justify-center rounded-md hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <Star
              aria-hidden="true"
              className={cn(
                'size-6',
                on ? 'text-ink' : 'text-border-strong group-hover:text-ink-muted',
              )}
              fill={on ? 'currentColor' : 'none'}
            />
          </button>
        );
      })}
    </div>
  );
}
