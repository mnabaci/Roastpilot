import { describe, expect, it } from 'vitest';
import { batchCount, describeBatches, formatGrams, planLine } from './batch-format';

describe('describeBatches', () => {
  it('groups batches by weight, the most common first', () => {
    expect(describeBatches([360, 356, 356, 356, 356])).toBe('4 × 356 g · 1 × 360 g');
    expect(describeBatches([400, 400])).toBe('2 × 400 g');
  });

  it('says nothing for no batches', () => {
    expect(describeBatches([])).toBe('');
  });
});

describe('planLine', () => {
  it('counts the batches left, then their weights', () => {
    expect(planLine([360, 356, 356, 356, 356], 250)).toBe('5 batches · 4 × 356 g · 1 × 360 g');
  });

  it('says when there is no batch to roast', () => {
    expect(planLine([], 250)).toBe('No green left');
    expect(planLine([120], 250)).toBe('Under one batch · the minimum is 250 g');
  });
});

describe('batchCount', () => {
  it('counts in words', () => {
    expect(batchCount(1)).toBe('1 batch');
    expect(batchCount(5)).toBe('5 batches');
  });
});

describe('formatGrams', () => {
  it('groups thousands', () => {
    expect(formatGrams(2270)).toBe('2,270 g');
  });
});
