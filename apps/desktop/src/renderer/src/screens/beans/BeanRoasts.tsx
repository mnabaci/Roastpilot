import { bestFavourite } from '@roastpilot/core';
import type { Bean, RoastSummary } from '@roastpilot/shared';
import { RoastTable } from '@roastpilot/ui';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { roastTitle } from '../history/history-format';
import { beanRoastRows } from './bean-roast-rows';

/** A bean's roasts, its best favourite named (docs/spec/beans-favourites-ghost.md, Favourites). */
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
        <RoastTable label={`Roasts of ${bean.name}`} rows={beanRoastRows(own, unit)} />
      ) : (
        <p className="text-label text-ink-muted">No roasts of this bean yet.</p>
      )}
    </div>
  );
}
