import { describe, expect, it } from 'vitest';
import { clampBatch, expectedRoastedG, splitStock } from './batch-plans';

const SIZES = { minG: 250, maxG: 400 };

describe('splitStock', () => {
  it('splits stock into equal batches near the target, the spare in the first', () => {
    expect(splitStock(1000, 375, SIZES)).toEqual([334, 333, 333]);
    expect(splitStock(2270, 375, SIZES)).toEqual([380, 378, 378, 378, 378, 378]);
  });

  it("aims for the bean's own batch, not the roaster's ideal", () => {
    expect(splitStock(1784, 356, SIZES)).toEqual([360, 356, 356, 356, 356]);
  });

  it('keeps batches inside min–max', () => {
    expect(splitStock(590, 375, SIZES)).toEqual([295, 295]);
    expect(Math.max(...splitStock(1590, 375, SIZES))).toBeLessThanOrEqual(400);
    expect(splitStock(520, 375, SIZES)).toEqual([260, 260]);
    // A target outside the roaster's range plans at its edge.
    expect(splitStock(1000, 500, SIZES)).toEqual([334, 333, 333]);
  });

  it('is one short batch below the minimum, and nothing with no stock', () => {
    expect(splitStock(100, 375, SIZES)).toEqual([100]);
    expect(splitStock(0, 375, SIZES)).toEqual([]);
    expect(splitStock(0.4, 375, SIZES)).toEqual([]);
  });
});

describe('clampBatch', () => {
  it('keeps a target inside the roaster', () => {
    expect(clampBatch(356, SIZES)).toBe(356);
    expect(clampBatch(500, SIZES)).toBe(400);
    expect(clampBatch(100, SIZES)).toBe(250);
  });
});

describe('expectedRoastedG', () => {
  it('uses the bean average, or 15% until it has one', () => {
    expect(expectedRoastedG(1000, 12)).toBe(880);
    expect(expectedRoastedG(1000, null)).toBe(850);
  });
});
