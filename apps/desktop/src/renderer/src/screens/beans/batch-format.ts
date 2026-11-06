import type { BatchPlan } from '@roastpilot/shared';

const grams = (g: number) => `${Math.round(g).toLocaleString('en-GB')} g`;

export { grams as formatGrams };

/** `3 × 333 g (+1 g)` or `2 × 375 g + 250 g` (docs/spec/batch-and-stock.md). */
export function describePlan({ kind, batchesG }: BatchPlan): string {
  const [first] = batchesG;
  if (first === undefined) return '';
  if (kind === 'equal') {
    const each = Math.min(...batchesG);
    const spare = batchesG.reduce((sum, g) => sum + g, 0) - each * batchesG.length;
    const count = `${String(batchesG.length)} × ${grams(each)}`;
    return spare > 0 ? `${count} (+${grams(spare)})` : count;
  }
  const whole = batchesG.filter((g) => g === first);
  const rest = batchesG.filter((g) => g !== first);
  return [`${String(whole.length)} × ${grams(first)}`, ...rest.map(grams)].join(' + ');
}
