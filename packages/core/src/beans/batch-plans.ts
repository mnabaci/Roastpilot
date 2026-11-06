import type { BatchPlan } from '@roastpilot/shared';

export interface BatchSizes {
  minG: number;
  idealG: number;
  maxG: number;
}

export interface BatchPlans {
  equal: BatchPlan;
  ideal: BatchPlan;
  /** The ideal plan's last batch is below the roaster's minimum. */
  idealLeftoverBelowMin: boolean;
}

/** Equal batches: as near the ideal as fits inside min–max; spare grams go in the first. */
function equalBatches(orderG: number, { minG, idealG, maxG }: BatchSizes): number[] {
  const fewest = Math.max(1, Math.ceil(orderG / maxG));
  const most = Math.max(1, Math.floor(orderG / minG));
  const count = Math.max(fewest, Math.min(most, Math.round(orderG / idealG) || 1));
  const each = Math.floor(orderG / count);
  const spare = Math.round(orderG - each * count);
  return Array.from({ length: count }, (_, i) => (i === 0 ? each + spare : each));
}

/**
 * The batch calculator's two plans (docs/spec/batch-and-stock.md). Grams only: expected roasted
 * output is `expectedRoastedG`.
 */
export function batchPlans(orderG: number, sizes: BatchSizes): BatchPlans {
  const whole = Math.floor(orderG / sizes.idealG);
  const rest = Math.round(orderG - whole * sizes.idealG);
  const idealBatches = [
    ...Array.from({ length: whole }, () => sizes.idealG),
    ...(rest > 0 ? [rest] : []),
  ];
  return {
    equal: { kind: 'equal', batchesG: equalBatches(orderG, sizes) },
    ideal: { kind: 'ideal', batchesG: idealBatches },
    idealLeftoverBelowMin: rest > 0 && rest < sizes.minG,
  };
}

/** The weight loss a bean is assumed to have until it has roasts of its own. */
export const DEFAULT_LOSS_PCT = 15;

export const expectedRoastedG = (greenG: number, lossPct: number | null): number =>
  Math.round(greenG * (1 - (lossPct ?? DEFAULT_LOSS_PCT) / 100));
