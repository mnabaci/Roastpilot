import { describe, expect, it } from 'vitest';
import { batchPlans, expectedRoastedG } from './batch-plans';

const SIZES = { minG: 250, idealG: 375, maxG: 400 };

describe('batchPlans', () => {
  it('splits 1,000 g as the spec says', () => {
    const plans = batchPlans(1000, SIZES);
    expect(plans.equal.batchesG).toEqual([334, 333, 333]);
    expect(plans.ideal.batchesG).toEqual([375, 375, 250]);
    expect(plans.idealLeftoverBelowMin).toBe(false);
  });

  it('splits 2,270 g as the spec says, flagging a leftover below the minimum', () => {
    const plans = batchPlans(2270, SIZES);
    expect(plans.equal.batchesG).toEqual([380, 378, 378, 378, 378, 378]);
    expect(plans.ideal.batchesG).toEqual([375, 375, 375, 375, 375, 375, 20]);
    expect(plans.idealLeftoverBelowMin).toBe(true);
  });

  it('keeps equal batches at or below the maximum', () => {
    expect(batchPlans(590, SIZES).equal.batchesG).toEqual([295, 295]);
    const { batchesG } = batchPlans(1590, SIZES).equal;
    expect(Math.max(...batchesG)).toBeLessThanOrEqual(400);
  });

  it('keeps equal batches at or above the minimum when it can', () => {
    expect(batchPlans(520, SIZES).equal.batchesG).toEqual([260, 260]);
  });

  it('copes with an order smaller than one batch', () => {
    const plans = batchPlans(100, SIZES);
    expect(plans.equal.batchesG).toEqual([100]);
    expect(plans.ideal.batchesG).toEqual([100]);
    expect(plans.idealLeftoverBelowMin).toBe(true);
  });

  it('has no leftover on an exact order', () => {
    const plans = batchPlans(750, SIZES);
    expect(plans.ideal.batchesG).toEqual([375, 375]);
    expect(plans.idealLeftoverBelowMin).toBe(false);
  });
});

describe('expectedRoastedG', () => {
  it('uses the bean average, or 15% until it has one', () => {
    expect(expectedRoastedG(1000, 12)).toBe(880);
    expect(expectedRoastedG(1000, null)).toBe(850);
  });
});
