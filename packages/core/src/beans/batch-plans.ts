export interface BatchSizes {
  minG: number;
  maxG: number;
}

/** The batch a plan aims for, kept inside the roaster's min–max. */
export const clampBatch = (targetG: number, { minG, maxG }: BatchSizes): number =>
  Math.min(maxG, Math.max(minG, targetG));

/**
 * Green stock as equal batches (docs/spec/batch-and-stock.md): as near the target as fits inside
 * min–max, the spare grams in the first, so the next roast takes it. Stock below the minimum is
 * one short batch; none at all, no batches.
 */
export function splitStock(greenG: number, targetG: number, sizes: BatchSizes): number[] {
  const stock = Math.round(greenG);
  if (stock <= 0) return [];
  const { minG, maxG } = sizes;
  const target = clampBatch(targetG, sizes);
  const fewest = Math.max(1, Math.ceil(stock / maxG));
  const most = Math.max(1, Math.floor(stock / minG));
  const count = Math.max(fewest, Math.min(most, Math.round(stock / target) || 1));
  const each = Math.floor(stock / count);
  const spare = stock - each * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? each + spare : each));
}

/** The weight loss a bean is assumed to have until it has roasts of its own. */
export const DEFAULT_LOSS_PCT = 15;

export const expectedRoastedG = (greenG: number, lossPct: number | null): number =>
  Math.round(greenG * (1 - (lossPct ?? DEFAULT_LOSS_PCT) / 100));
