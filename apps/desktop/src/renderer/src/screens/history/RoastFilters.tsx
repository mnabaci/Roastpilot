import type { Bean, RoastSummary } from '@roastpilot/shared';
import { Button, cn, FilterSelect } from '@roastpilot/ui';
import { Star } from 'lucide-react';
import { ALL, MANUAL, NO_BEAN, profileOptions, type RoastFilter } from './roast-filter';

/** One row of filters over the roast list; a chip turns ember while it filters. */
export function RoastFilters({
  filter,
  onChange,
  beans,
  roasts,
}: {
  filter: RoastFilter;
  onChange: (filter: RoastFilter) => void;
  beans: readonly Bean[];
  /** Every saved roast, for the profiles they ran. */
  roasts: readonly RoastSummary[];
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        aria-label="Favourites only"
        aria-pressed={filter.favourites}
        icon={
          <Star aria-hidden="true" className={filter.favourites ? 'fill-current' : undefined} />
        }
        className={cn('shrink-0', filter.favourites && 'bg-heat-tint text-heat')}
        onClick={() => {
          onChange({ ...filter, favourites: !filter.favourites });
        }}
      />
      <FilterSelect
        label="Bean"
        className="flex-1"
        allValue={ALL}
        value={filter.bean}
        options={[
          { value: ALL, label: 'All' },
          { value: NO_BEAN, label: 'No bean' },
          ...beans.map((b) => ({ value: String(b.id), label: b.name })),
        ]}
        onChange={(bean) => {
          onChange({ ...filter, bean });
        }}
      />
      <FilterSelect
        label="Profile"
        className="flex-1"
        allValue={ALL}
        value={filter.profile}
        options={[
          { value: ALL, label: 'All' },
          { value: MANUAL, label: 'Manual' },
          ...profileOptions(roasts),
        ]}
        onChange={(profile) => {
          onChange({ ...filter, profile });
        }}
      />
    </div>
  );
}
