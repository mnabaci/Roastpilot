import { formatTemp, type RoastSummary, type TemperatureUnit } from '@roastpilot/shared';
import { formatClock, formatNumber, type RoastTableRow } from '@roastpilot/ui';
import { weightLossPct } from '../../features/roast-result';
import { howItRan, roastTitle } from '../history/history-format';

/** `356 → 305 g` once both weights are in; `356 g` before the roast is weighed. */
function weights({ batchG, roastedG }: Pick<RoastSummary, 'batchG' | 'roastedG'>) {
  if (batchG === null) return undefined;
  if (roastedG === null) return `${formatNumber(batchG, 0)} g`;
  return `${formatNumber(batchG, 0)} → ${formatNumber(roastedG, 0)} g`;
}

/** A bean's roasts as table rows (docs/spec/ui.md, Beans screen). */
export function beanRoastRows(
  roasts: readonly RoastSummary[],
  unit: TemperatureUnit,
): RoastTableRow[] {
  return roasts.map((roast) => {
    const loss = weightLossPct(roast);
    return {
      id: roast.id,
      title: roastTitle(roast.startedAt),
      favourite: roast.isFavourite,
      ran: howItRan(roast),
      time: roast.dropTimeS === null ? undefined : formatClock(roast.dropTimeS),
      fc: roast.fcTimeS === null ? undefined : formatClock(roast.fcTimeS),
      drop: roast.dropTemp === null ? undefined : formatTemp(roast.dropTemp, unit, 1),
      weights: weights(roast),
      loss: loss === undefined ? undefined : `${formatNumber(loss, 1)} %`,
      rating: roast.rating ?? undefined,
    };
  });
}
