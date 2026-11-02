import { describe, expect, it } from 'vitest';
import { alignLayers } from './align-layers';
import type { ChartLayer } from './chart-layer';

const layer = (id: string, points: [number, number][]): ChartLayer => ({
  id,
  label: id,
  axis: 'temperature',
  tone: 'heat',
  width: 2,
  points: points.map(([t, v]) => ({ t, v })),
});

describe('alignLayers', () => {
  it('merges times and fills gaps with null', () => {
    const aligned = alignLayers([
      layer('bt', [
        [0, 180],
        [2, 170],
      ]),
      layer('ror', [
        [1, 5],
        [2, 6],
      ]),
    ]);
    expect(aligned).toEqual({
      xs: [0, 1, 2],
      series: [
        [180, null, 170],
        [null, 5, 6],
      ],
    });
  });

  it('sorts times, including negative preheat times', () => {
    expect(
      alignLayers([
        layer('bt', [
          [5, 1],
          [-30, 2],
          [0, 3],
        ]),
      ]).xs,
    ).toEqual([-30, 0, 5]);
  });

  it('handles no layers and empty layers', () => {
    expect(alignLayers([])).toEqual({ xs: [], series: [] });
    expect(alignLayers([layer('bt', [])])).toEqual({ xs: [], series: [[]] });
  });
});
