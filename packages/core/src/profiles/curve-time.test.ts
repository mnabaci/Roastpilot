import { describe, expect, it } from 'vitest';
import { timeAtC } from './curve-time';

describe('timeAtC', () => {
  const curve = [
    { tS: 0, c: 180 },
    { tS: 60, c: 90 },
    { tS: 160, c: 190 },
  ];
  it('finds the climb, not the fall after charge', () => {
    expect(timeAtC(curve, 150)).toBe(120);
  });
  it('is undefined for a temperature never reached', () => {
    expect(timeAtC(curve, 195)).toBeUndefined();
  });
});
