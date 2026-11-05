import type { RoastResult, RoastSummary } from '@roastpilot/shared';

/** The weights and notes as typed. */
export interface ResultDraft {
  batch: string;
  roasted: string;
  notes: string;
}

export const toResultDraft = (roast: RoastSummary): ResultDraft => ({
  batch: roast.batchG === null ? '' : String(roast.batchG),
  roasted: roast.roastedG === null ? '' : String(roast.roastedG),
  notes: roast.notes ?? '',
});

const grams = (typed: string): number | null | undefined => {
  if (typed.trim() === '') return null;
  const value = Number(typed);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

/** A weight cell that can't be saved as typed. */
export const badWeight = (typed: string): boolean => grams(typed) === undefined;

/** What to save, or undefined while a weight isn't a number above 0. */
export function resultFromDraft(
  draft: ResultDraft,
  rest: Pick<RoastResult, 'id' | 'rating' | 'isFavourite'>,
): RoastResult | undefined {
  const [batchG, roastedG] = [grams(draft.batch), grams(draft.roasted)];
  if (batchG === undefined || roastedG === undefined) return undefined;
  return { ...rest, batchG, roastedG, notes: draft.notes.trim() === '' ? null : draft.notes };
}

/** Weight loss %, once both weights are in and make sense. */
export function weightLossPct(result: RoastResult | undefined): number | undefined {
  const batchG = result?.batchG ?? null;
  const roastedG = result?.roastedG ?? null;
  if (batchG === null || roastedG === null || roastedG > batchG) return undefined;
  return ((batchG - roastedG) / batchG) * 100;
}
