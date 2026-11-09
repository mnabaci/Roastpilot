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

/** What a weight is checked against: the batch limit of the roaster the roast ran on. */
export interface WeightLimits {
  maxBatchG?: number | undefined;
  roasterName?: string | undefined;
}

/** One line per weight cell that can't be saved as typed (docs/spec/ui.md, After cooling). */
export function weightProblems(
  draft: Pick<ResultDraft, 'batch' | 'roasted'>,
  limits: WeightLimits = {},
): { batch?: string; roasted?: string } {
  const [batchG, roastedG] = [grams(draft.batch), grams(draft.roasted)];
  const problems: { batch?: string; roasted?: string } = {};
  if (batchG === undefined) problems.batch = 'Enter a weight above 0';
  else if (batchG !== null && limits.maxBatchG !== undefined && batchG > limits.maxBatchG)
    problems.batch = `At most ${String(limits.maxBatchG)} g on ${limits.roasterName ?? 'this roaster'}`;
  if (roastedG === undefined) problems.roasted = 'Enter a weight above 0';
  else if (roastedG !== null && typeof batchG === 'number' && roastedG > batchG)
    problems.roasted = "Roasted can't be more than green";
  else if (roastedG !== null && limits.maxBatchG !== undefined && roastedG > limits.maxBatchG)
    problems.roasted = `At most ${String(limits.maxBatchG)} g on ${limits.roasterName ?? 'this roaster'}`;
  return problems;
}

/** What to save, or undefined while a weight has a problem. */
export function resultFromDraft(
  draft: ResultDraft,
  rest: Pick<RoastResult, 'id' | 'rating' | 'isFavourite'>,
  limits: WeightLimits = {},
): RoastResult | undefined {
  const problems = weightProblems(draft, limits);
  if (problems.batch || problems.roasted) return undefined;
  const [batchG, roastedG] = [grams(draft.batch), grams(draft.roasted)];
  if (batchG === undefined || roastedG === undefined) return undefined;
  return { ...rest, batchG, roastedG, notes: draft.notes.trim() === '' ? null : draft.notes };
}

/** Usual weight loss for a roast; outside it the weights are probably mistyped. */
const USUAL_LOSS_PCT = { min: 5, max: 30 } as const;

/** A quiet word when the loss is unusual: it saves anyway, as odd roasts happen. */
export const lossHint = (lossPct: number | undefined): string | undefined =>
  lossPct !== undefined && (lossPct < USUAL_LOSS_PCT.min || lossPct > USUAL_LOSS_PCT.max)
    ? 'Unusual · 12–20 % is common, check the weights'
    : undefined;

/** Weight loss %, once both weights are in and make sense. */
export function weightLossPct(
  result: Pick<RoastResult, 'batchG' | 'roastedG'> | undefined,
): number | undefined {
  const batchG = result?.batchG ?? null;
  const roastedG = result?.roastedG ?? null;
  if (batchG === null || roastedG === null || roastedG > batchG) return undefined;
  return ((batchG - roastedG) / batchG) * 100;
}
