import type { RoastSummary } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import {
  lossHint,
  resultFromDraft,
  toResultDraft,
  weightLossPct,
  weightProblems,
} from './roast-result';

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

  describe('weight problems', () => {
    const SKYWALKER = { maxBatchG: 400, roasterName: 'Skywalker' };

    it("green can be at most the roaster's max batch", () => {
      expect(weightProblems({ batch: '450', roasted: '' }, SKYWALKER)).toEqual({
        batch: 'At most 400 g on Skywalker',
      });
      expect(weightProblems({ batch: '400', roasted: '' }, SKYWALKER)).toEqual({});
    });

    it('roasted can never be more than green', () => {
      expect(weightProblems({ batch: '300', roasted: '350' }, SKYWALKER)).toEqual({
        roasted: "Roasted can't be more than green",
      });
    });

    it('roasted alone still stays within the roaster', () => {
      expect(weightProblems({ batch: '', roasted: '500' }, SKYWALKER)).toEqual({
        roasted: 'At most 400 g on Skywalker',
      });
    });

    it('a weight must be a number above 0', () => {
      expect(weightProblems({ batch: '0', roasted: 'x' })).toEqual({
        batch: 'Enter a weight above 0',
        roasted: 'Enter a weight above 0',
      });
    });

    it('nothing is saved while one has a problem', () => {
      expect(
        resultFromDraft({ batch: '300', roasted: '350', notes: '' }, REST, SKYWALKER),
      ).toBeUndefined();
    });
  });

  it('flags an unusual loss without blocking it', () => {
    expect(lossHint(15)).toBeUndefined();
    expect(lossHint(2)).toMatch(/Unusual/);
    expect(lossHint(40)).toMatch(/Unusual/);
    expect(lossHint(undefined)).toBeUndefined();
  });
});
