import { describe, expect, it } from 'vitest';
import { formatClock, formatNumber } from './format';

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [9.9, '0:09'],
    [618, '10:18'],
    [-80, '-1:20'],
  ])('%d s is %s', (seconds, text) => {
    expect(formatClock(seconds)).toBe(text);
  });
});

describe('formatNumber', () => {
  it('rounds to the given decimals', () => {
    expect(formatNumber(8.64, 1)).toBe('8.6');
  });

  it.each([
    [-0.04, 1, '0.0'],
    [-0.3, 1, '-0.3'],
    [-0.4, 0, '0'],
  ])('%d to %d decimals is %s, never -0', (value, decimals, text) => {
    expect(formatNumber(value, decimals)).toBe(text);
  });

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    'gives nothing for %s',
    (value) => {
      expect(formatNumber(value, 1)).toBeUndefined();
    },
  );
});
