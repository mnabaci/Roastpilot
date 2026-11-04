import type { Reading } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { READY_ROAST } from '../../stores/roast-store';
import { roastChartData } from './roast-chart-data';

const RAW = { smoothingS: 0 };

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
      RAW,
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
    const { layers } = roastChartData(
      READY_ROAST,
      [{ atMs: 8_000, values: { heater: 0 } }, ...readings],
      RAW,
    );
    expect(layers[0]?.points[0]).toEqual({ t: 2, v: 100 });
  });

  it('cool-end is not a marker', () => {
    const { markers } = roastChartData(
      { ...READY_ROAST, phase: 'done', events: [{ kind: 'cool-end', atMs: 1, bt: null }] },
      readings,
      RAW,
    );
    expect(markers).toEqual([]);
  });

  it('heater and fan as step layers for the strip, skipping readings without them', () => {
    const { layers } = roastChartData(
      READY_ROAST,
      [
        { atMs: 0, values: { bt: 100, heater: 100, fan: 30 } },
        { atMs: 1_000, values: { bt: 101 } },
        { atMs: 2_000, values: { bt: 102, heater: 70, fan: 30 } },
      ],
      RAW,
    );
    const byId = Object.fromEntries(layers.map((l) => [l.id, l]));
    expect(byId.heater).toMatchObject({
      axis: 'output',
      tone: 'heat',
      step: true,
      points: [
        { t: 0, v: 100 },
        { t: 2, v: 70 },
      ],
    });
    expect(byId.fan).toMatchObject({
      axis: 'output',
      tone: 'air',
      step: true,
      points: [
        { t: 0, v: 30 },
        { t: 2, v: 30 },
      ],
    });
  });

  it('breaks every line where readings are more than 3 s apart', () => {
    const { layers } = roastChartData(
      READY_ROAST,
      [
        { atMs: 0, values: { bt: 48, heater: 30 } },
        { atMs: 1_000, values: { bt: 48, heater: 30 } },
        { atMs: 26_000, values: { bt: 50.7, heater: 0 } },
      ],
      RAW,
    );
    const byId = Object.fromEntries(layers.map((l) => [l.id, l]));
    expect(byId.bt?.points).toEqual([
      { t: 0, v: 48 },
      { t: 1, v: 48 },
      { t: 13.5, v: null },
      { t: 26, v: 50.7 },
    ]);
    expect(byId.heater?.points).toContainEqual({ t: 13.5, v: null });
    expect(byId.ror?.points).toContainEqual({ t: 13.5, v: null });
  });

  it('smooths the drawn temperature over the window, restarting after a break', () => {
    const jitter = [20, 20.3, 20, 20.3, 20, 20.3, 20, 20.3, 20, 20.3];
    const { layers } = roastChartData(
      READY_ROAST,
      [
        ...jitter.map((bt, s) => ({ atMs: s * 1000, values: { bt } })),
        { atMs: 20_000, values: { bt: 30 } },
      ],
      { smoothingS: 5 },
    );
    const points = layers[0]?.points ?? [];
    // Five readings in each 5 s window after the first few: the jitter averages out.
    for (const p of points.slice(5, 10)) expect(p.v).toBeCloseTo(20.15, 1);
    // After the break the line starts again from the raw reading.
    expect(points.at(-1)).toEqual({ t: 20, v: 30 });
  });

  it('draws the raw readings with smoothing off', () => {
    const { layers } = roastChartData(
      READY_ROAST,
      [
        { atMs: 0, values: { bt: 20 } },
        { atMs: 1_000, values: { bt: 20.3 } },
      ],
      RAW,
    );
    expect(layers[0]?.points.map((p) => p.v)).toEqual([20, 20.3]);
  });
});
