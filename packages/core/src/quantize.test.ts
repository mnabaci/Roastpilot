import type { OutputChannel } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { quantize } from './quantize';

const percent5: OutputChannel = {
  id: 'heater',
  kind: 'output',
  unit: 'percent',
  min: 0,
  max: 100,
  step: 5,
};

describe('quantize', () => {
  it.each([
    [42, 40],
    [43, 45],
    [37.5, 40],
    [100, 100],
    [0, 0],
  ])('rounds %d to the nearest step: %d', (input, expected) => {
    expect(quantize(percent5, input)).toBe(expected);
  });

  it('clamps above the maximum and below the minimum', () => {
    expect(quantize(percent5, 140)).toBe(100);
    expect(quantize(percent5, -20)).toBe(0);
  });

  it('turns NaN into the minimum', () => {
    expect(quantize(percent5, Number.NaN)).toBe(0);
  });

  it('never rounds past the maximum when max is not a multiple of step', () => {
    const odd: OutputChannel = { ...percent5, max: 98 };
    expect(quantize(odd, 98)).toBe(95);
  });
});
