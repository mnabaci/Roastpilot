import type { Reading } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { READY_ROAST } from '../../stores/roast-store';
import { roastChartData } from './roast-chart-data';

const readings: Reading[] = Array.from({ length: 61 }, (_, s) => ({
  atMs: 10_000 + s * 1000,
  values: { bt: 100 + s / 6 },
}));

describe('roastChartData', () => {
  it('temperature and RoR layers in seconds since charge, with markers', () => {
    const { layers, markers } = roastChartData(
      {
        ...READY_ROAST,
        phase: 'roasting',
        chargedAtMs: 20_000,
        events: [{ kind: 'charge', atMs: 20_000, bt: 101 }],
      },
      readings,
    );
    const [bt, ror] = layers;
    expect(bt?.points[0]).toEqual({ t: -10, v: 100 });
    expect(bt?.points).toHaveLength(61);
    // RoR waits for a full 30 s window.
    expect(ror?.points[0]?.t).toBeGreaterThanOrEqual(17);
    expect(ror?.points.at(-1)?.v).toBeCloseTo(10);
    expect(markers).toEqual([{ id: 'charge', label: 'Charge', t: 0, tone: 'ink' }]);
  });

  it('before charge, time counts from the first reading and readings without BT are skipped', () => {
    const { layers } = roastChartData(READY_ROAST, [
      { atMs: 5_000, values: { heater: 0 } },
      ...readings,
    ]);
    expect(layers[0]?.points[0]).toEqual({ t: 5, v: 100 });
  });

  it('cool-end is not a marker', () => {
    const { markers } = roastChartData(
      { ...READY_ROAST, phase: 'done', events: [{ kind: 'cool-end', atMs: 1, bt: null }] },
      readings,
    );
    expect(markers).toEqual([]);
  });
});
