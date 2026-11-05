import { describe, expect, it } from 'vitest';
import { describePlan, formatGrams } from './batch-format';

describe('describePlan', () => {
  it('equal splits show the spare grams', () => {
    expect(describePlan({ kind: 'equal', batchesG: [334, 333, 333] })).toBe('3 × 333 g (+1 g)');
    expect(describePlan({ kind: 'equal', batchesG: [400, 400] })).toBe('2 × 400 g');
  });

  it('ideal plans show the leftover', () => {
    expect(describePlan({ kind: 'ideal', batchesG: [375, 375, 250] })).toBe('2 × 375 g + 250 g');
    expect(describePlan({ kind: 'ideal', batchesG: [375] })).toBe('1 × 375 g');
  });

  it('an empty plan says nothing', () => {
    expect(describePlan({ kind: 'ideal', batchesG: [] })).toBe('');
  });
});

describe('formatGrams', () => {
  it('groups thousands', () => {
    expect(formatGrams(2270)).toBe('2,270 g');
  });
});
