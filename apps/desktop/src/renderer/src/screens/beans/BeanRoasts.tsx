import { bestFavourite } from '@roastpilot/core';
import type { Bean, RoastSummary } from '@roastpilot/shared';
import { RoastList } from '@roastpilot/ui';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { roastNumbers, roastTitle } from '../history/history-format';

/** A bean's roasts, its best favourite marked (docs/spec/beans-favourites-ghost.md, Favourites). */
export function BeanRoasts({ bean, roasts }: { bean: Bean; roasts: readonly RoastSummary[] }) {
  const own = roasts.filter((r) => r.beanId === bean.id);
  const best = bestFavourite(own);
  const unit = useTemperatureUnit();
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-label text-ink-muted">
        {best ? `Best favourite: ${roastTitle(best.startedAt)}` : 'No favourite yet'}
      </h3>
      {own.length > 0 ? (
        <RoastList
          label={`Roasts of ${bean.name}`}
          selectedId={best?.id}
          onSelect={() => undefined}
          items={own.map((r) => ({
            id: r.id,
            title: roastTitle(r.startedAt),
            numbers: roastNumbers(r, unit),
            favourite: r.isFavourite,
            ...(r.rating === null ? {} : { detail: `${String(r.rating)}/5` }),
          }))}
        />
      ) : (
        <p className="text-label text-ink-muted">No roasts of this bean yet.</p>
      )}
    </div>
  );
}
