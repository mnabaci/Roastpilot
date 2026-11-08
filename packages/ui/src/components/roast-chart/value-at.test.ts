import { describe, expect, it } from 'vitest';
import type { LineLayer } from './chart-layer';
import { formatLayerValue, valueAt, valueNow } from './value-at';

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

describe('valueNow', () => {
  const ror = layer([
    [0, 9],
    [5, 7],
  ]);

  it("is the held value up to the layer's last point", () => {
    expect(valueNow(ror, 3)).toBe(9);
    expect(valueNow(ror, 5)).toBe(7);
  });

  it('is undefined once the layer has ended, and for an empty one', () => {
    expect(valueNow(ror, 6)).toBeUndefined();
    expect(valueNow(layer([]), 0)).toBeUndefined();
  });
});

describe('formatLayerValue', () => {
  it('puts the unit after the value', () => {
    expect(formatLayerValue('temperature', 198.44, 'c')).toBe('198.4 °C');
    expect(formatLayerValue('ror', 9.06, 'c')).toBe('9.1 °C/min');
    expect(formatLayerValue('output', 64.6, 'c')).toBe('65%');
  });

  it('says a value already in °F with °F, the temperature whole', () => {
    expect(formatLayerValue('temperature', 389.12, 'f')).toBe('389 °F');
    expect(formatLayerValue('ror', 16.38, 'f')).toBe('16.4 °F/min');
    expect(formatLayerValue('output', 64.6, 'f')).toBe('65%');
  });
});
