import type { RoastSummary } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { resultFromDraft, toResultDraft, weightLossPct } from './roast-result';

const REST = { id: 1, rating: null, isFavourite: false };

describe('roast result', () => {
  it('turns typed weights into grams and empty cells into nothing', () => {
    expect(resultFromDraft({ batch: '375', roasted: '', notes: '' }, REST)).toEqual({
      ...REST,
      batchG: 375,
      roastedG: null,
      notes: null,
    });
  });

  it('waits while a weight is not a number above 0', () => {
    expect(resultFromDraft({ batch: 'x', roasted: '', notes: '' }, REST)).toBeUndefined();
    expect(resultFromDraft({ batch: '0', roasted: '', notes: '' }, REST)).toBeUndefined();
  });

  it('starts from what the roast has', () => {
    const roast = { batchG: 375, roastedG: null, notes: 'Bright' } as RoastSummary;
    expect(toResultDraft(roast)).toEqual({ batch: '375', roasted: '', notes: 'Bright' });
  });

  it('works out weight loss once both weights are in', () => {
    const result = { ...REST, batchG: 400, roastedG: 340, notes: null };
    expect(weightLossPct(result)).toBe(15);
    expect(weightLossPct({ ...result, roastedG: null })).toBeUndefined();
    expect(weightLossPct({ ...result, roastedG: 500 })).toBeUndefined();
    expect(weightLossPct(undefined)).toBeUndefined();
  });
});
