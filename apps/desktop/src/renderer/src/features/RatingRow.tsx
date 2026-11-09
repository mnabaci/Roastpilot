import { Button } from '@roastpilot/ui';
import { Star } from 'lucide-react';
import { useId } from 'react';

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * Rating 1–5 (pressing the chosen one again clears it) and the favourite star, as one group under
 * a Rating label like the fields around it.
 */
export function RatingRow({
  rating,
  isFavourite,
  onChange,
}: {
  rating: number | null;
  isFavourite: boolean;
  onChange: (next: { rating: number | null; isFavourite: boolean }) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-label text-ink-muted">
        Rating
      </span>
      <div className="flex items-center gap-1">
        <div role="group" aria-labelledby={labelId} className="flex gap-1">
          {RATINGS.map((value) => (
            <Button
              key={value}
              size="sm"
              aria-pressed={rating === value}
              className={rating === value ? 'bg-heat-tint text-heat' : undefined}
              onClick={() => {
                onChange({ rating: rating === value ? null : value, isFavourite });
              }}
            >
              {value}
            </Button>
          ))}
        </div>
        <span aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
        <Button
          size="sm"
          variant="ghost"
          aria-label="Favourite"
          aria-pressed={isFavourite}
          className={isFavourite ? 'text-heat' : 'text-ink-muted'}
          icon={<Star aria-hidden="true" fill={isFavourite ? 'currentColor' : 'none'} />}
          onClick={() => {
            onChange({ rating, isFavourite: !isFavourite });
          }}
        />
      </div>
    </div>
  );
}
