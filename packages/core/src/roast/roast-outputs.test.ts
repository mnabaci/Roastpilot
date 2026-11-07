import type { Channel } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { drumOnValue } from './roast-outputs';

const drum = (unit: 'on-off' | 'percent'): Channel => ({
  id: 'drum',
  kind: 'output',
  unit,
  min: 0,
  max: unit === 'percent' ? 100 : 1,
  step: unit === 'percent' ? 5 : 1,
});

describe('drumOnValue', () => {
  it('is the usual speed for a drum with a speed', () => {
    expect(drumOnValue([drum('percent')], 45)).toBe(45);
  });

  it('is 1 for an on/off drum, or with no roaster connected', () => {
    expect(drumOnValue([drum('on-off')], 45)).toBe(1);
    expect(drumOnValue([], 45)).toBe(1);
  });
});
