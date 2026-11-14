import { READY_ROAST, type Reading } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { roastChartData } from './roast-chart-data';

const RAW = { smoothingS: 0 };

const readings: Reading[] = Array.from({ length: 61 }, (_, s) => ({
  atMs: 10_000 + s * 1000,
  values: { bt: 100 + s / 6 },
}));

describe('roastChartData temperature lines', () => {
  it('draws ET where the roast recorded it, thinner and behind the bean temperature', () => {
    const withEt = readings.map((r) => ({ ...r, values: { ...r.values, et: 120 } }));
    const { layers } = roastChartData(READY_ROAST, withEt, { ...RAW, etShort: 'ET' });
    const ids = layers.map((l) => l.id);
    expect(ids.indexOf('et')).toBeLessThan(ids.indexOf('bt'));
    const et = layers.find((l) => l.id === 'et');
    expect(et).toMatchObject({ label: 'ET', axis: 'temperature', tone: 'env', width: 2 });
    expect(et?.points[0]).toEqual({ t: 0, v: 120 });
  });

  it('has no ET line for a roast without ET readings', () => {
    const { layers } = roastChartData(READY_ROAST, readings, RAW);
    expect(layers.some((l) => l.id === 'et')).toBe(false);
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

  it('weights newer readings more, so a rise lags less than a plain average', () => {
    const step = [20, 20, 20, 20, 20, 30];
    const { layers } = roastChartData(
      READY_ROAST,
      step.map((bt, s) => ({ atMs: s * 1000, values: { bt } })),
      { smoothingS: 5 },
    );
    // Weights 1–5 over the last five readings: (20·(1+2+3+4) + 30·5) / 15 = 23.3; a plain
    // average would show 22.
    expect(layers[0]?.points.at(-1)?.v).toBeCloseTo(23.33, 1);
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
