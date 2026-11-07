import { Button } from '@roastpilot/ui';
import { Star } from 'lucide-react';

const RATINGS = [1, 2, 3, 4, 5] as const;

/** Rating 1–5 (pressing the chosen one again clears it) and the favourite star. */
export function RatingRow({
  rating,
  isFavourite,
  onChange,
}: {
  rating: number | null;
  isFavourite: boolean;
  onChange: (next: { rating: number | null; isFavourite: boolean }) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <div role="group" aria-label="Rating" className="flex gap-1">
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
  );
}
