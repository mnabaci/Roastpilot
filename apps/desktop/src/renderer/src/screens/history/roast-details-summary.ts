import type { Bean, RoastSummary } from '@roastpilot/shared';
import { formatNumber } from '@roastpilot/ui';
import { weightLossPct } from '../../features/roast-result';

const STARS = 5;

/** A part of the line, with how a screen reader says it when the symbols don't read well. */
interface Part {
  shown: string;
  spoken?: string;
}

function weights({ batchG, roastedG }: Pick<RoastSummary, 'batchG' | 'roastedG'>): Part[] {
  if (batchG !== null && roastedG !== null)
    return [{ shown: `${String(batchG)} → ${String(roastedG)} g` }];
  if (batchG !== null) return [{ shown: `${String(batchG)} g` }];
  if (roastedG !== null) return [{ shown: `${String(roastedG)} g roasted` }];
  return [];
}

/**
 * The Roast details card's line while folded (docs/spec/ui.md, History): bean, green → roasted,
 * weight loss, rating as stars out of 5, Favourite, and the notes' first line; only the parts the
 * roast has. Undefined when it has none.
 */
export function roastDetailsSummary(
  roast: RoastSummary,
  beans: readonly Pick<Bean, 'id' | 'name'>[],
): { shown: string; spoken: string } | undefined {
  const bean = beans.find((b) => b.id === roast.beanId)?.name;
  const loss = formatNumber(weightLossPct(roast), 1);
  const firstLine = roast.notes
    ?.split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '');
  const parts: Part[] = [
    ...(bean ? [{ shown: bean }] : []),
    ...weights(roast),
    ...(loss === undefined ? [] : [{ shown: `${loss} %` }]),
    ...(roast.rating === null
      ? []
      : [
          {
            shown: '★'.repeat(roast.rating) + '☆'.repeat(STARS - roast.rating),
            spoken: `rated ${String(roast.rating)} of ${String(STARS)}`,
          },
        ]),
    ...(roast.isFavourite ? [{ shown: 'Favourite' }] : []),
    ...(firstLine ? [{ shown: firstLine }] : []),
  ];
  if (parts.length === 0) return undefined;
  return {
    shown: parts.map((p) => p.shown).join(' · '),
    spoken: parts.map((p) => p.spoken ?? p.shown).join(' · '),
  };
}
