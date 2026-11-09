const grams = (g: number) => `${Math.round(g).toLocaleString('en-GB')} g`;

export { grams as formatGrams };

/** Batches grouped by weight, the most common first: `4 × 356 g · 1 × 360 g`. */
export function describeBatches(batchesG: readonly number[]): string {
  const counts = new Map<number, number>();
  for (const g of batchesG) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([g, n]) => `${String(n)} × ${grams(g)}`)
    .join(' · ');
}

/**
 * A bean's plan in one line, for its Green card: `5 batches · 4 × 356 g · 1 × 360 g`; stock too
 * small for a batch, or none, says so.
 */
export function planLine(batchesG: readonly number[], minG: number): string {
  const [first] = batchesG;
  if (first === undefined) return 'No green left';
  if (first < minG) return `Under one batch · the minimum is ${grams(minG)}`;
  return `${batchCount(batchesG.length)} · ${describeBatches(batchesG)}`;
}

/** `5 batches` or `1 batch`. */
export const batchCount = (n: number): string => `${String(n)} ${n === 1 ? 'batch' : 'batches'}`;
