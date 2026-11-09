import { Button, StarRating } from '@roastpilot/ui';
import { Heart } from 'lucide-react';
import { useId } from 'react';

/**
 * Rating as 1–5 stars (pressing the chosen one again clears it) and the favourite star, as one group under
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
        <StarRating
          label="Rating"
          value={rating}
          onChange={(next) => {
            onChange({ rating: next, isFavourite });
          }}
          className="-ml-2.5"
        />
        <span aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
        <Button
          size="sm"
          variant="ghost"
          aria-label="Favourite"
          aria-pressed={isFavourite}
          className={isFavourite ? 'text-heat' : 'text-ink-muted'}
          icon={<Heart aria-hidden="true" fill={isFavourite ? 'currentColor' : 'none'} />}
          onClick={() => {
            onChange({ rating, isFavourite: !isFavourite });
          }}
        />
      </div>
    </div>
  );
}
