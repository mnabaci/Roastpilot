import { describe, expect, it, vi } from 'vitest';
import type { ChartLayer } from './chart-layer';
import { dragInUnit, floorInUnit, layersInUnit } from './display-units';

const LAYERS: ChartLayer[] = [
  {
    id: 'bt',
    label: 'Temperature',
    axis: 'temperature',
    tone: 'heat',
    width: 3.5,
    points: [
      { t: 0, v: 200 },
      { t: 1, v: null },
    ],
  },
  { id: 'ror', label: 'RoR', axis: 'ror', tone: 'air', width: 2, points: [{ t: 0, v: 10 }] },
  {
    id: 'heater',
    label: 'Heater',
    axis: 'output',
    tone: 'heat',
    width: 2,
    points: [{ t: 0, v: 60 }],
  },
  {
    kind: 'projection',
    id: 'projection',
    axis: 'ror',
    tone: 'air',
    points: [{ t: 0, v: -10 }],
  },
  {
    kind: 'phase-bands',
    id: 'bands',
    bands: [
      { label: 'Drying', toC: 150 },
      { label: 'Maillard', fromC: 150 },
    ],
  },
  { kind: 'now-line', id: 'now', t: 42 },
];

describe('layersInUnit', () => {
  it('leaves °C as it is', () => {
    expect(layersInUnit(LAYERS, 'c')).toBe(LAYERS);
  });

  it('converts a temperature with + 32 and a RoR without, leaving outputs and gaps alone', () => {
    const [bt, ror, heater, projection, bands, now] = layersInUnit(LAYERS, 'f');
    expect(bt).toMatchObject({
      points: [
        { t: 0, v: 392 },
        { t: 1, v: null },
      ],
    });
    expect(ror).toMatchObject({ points: [{ t: 0, v: 18 }] });
    expect(heater).toMatchObject({ points: [{ t: 0, v: 60 }] });
    // A RoR projection is a rate too: −10 °C/min is −18 °F/min, never +14.
    expect(projection).toMatchObject({ points: [{ t: 0, v: -18 }] });
    expect(bands).toMatchObject({ bands: [{ toC: 302 }, { fromC: 302 }] });
    expect(now).toEqual({ kind: 'now-line', id: 'now', t: 42 });
  });
});

describe('dragInUnit', () => {
  it('shows the points in °F and moves them back in °C', () => {
    const onMove = vi.fn();
    const drag = dragInUnit({ points: [{ t: 60, v: 100 }], onMove }, 'f');
    expect(drag?.points).toEqual([{ t: 60, v: 212 }]);
    drag?.onMove(0, { t: 90, v: 392 });
    expect(onMove).toHaveBeenCalledWith(0, { t: 90, v: 200 });
  });
});

describe('floorInUnit', () => {
  it('puts the floor where the °F axis has it, free of float dust', () => {
    expect(floorInUnit(0, 'f')).toBe(32);
    expect(floorInUnit((100 - 32) / 1.8, 'f')).toBe(100);
    expect(floorInUnit(50, 'c')).toBe(50);
  });
});
