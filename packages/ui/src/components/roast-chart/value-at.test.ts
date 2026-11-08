import { describe, expect, it } from 'vitest';
import type { LineLayer } from './chart-layer';
import { formatLayerValue, valueAt } from './value-at';

const layer = (points: [number, number | null][]): LineLayer => ({
  id: 'bt',
  label: 'Temperature',
  axis: 'temperature',
  tone: 'heat',
  width: 3.5,
  points: points.map(([t, v]) => ({ t, v })),
});

describe('valueAt', () => {
  const bt = layer([
    [0, 180],
    [1, 178],
    [2, null],
    [5, 175],
  ]);

  it('holds the last value at or before the time', () => {
    expect(valueAt(bt, 0)).toBe(180);
    expect(valueAt(bt, 1.6)).toBe(178);
    expect(valueAt(bt, 9)).toBe(175);
  });

  it('is undefined before the first point and inside a break', () => {
    expect(valueAt(bt, -1)).toBeUndefined();
    expect(valueAt(bt, 3)).toBeUndefined();
    expect(valueAt(layer([]), 1)).toBeUndefined();
  });
});

describe('formatLayerValue', () => {
  it('puts the unit after the value', () => {
    expect(formatLayerValue('temperature', 198.44)).toBe('198.4 °C');
    expect(formatLayerValue('ror', 9.06)).toBe('9.1 °C/min');
    expect(formatLayerValue('output', 64.6)).toBe('65%');
  });
});
