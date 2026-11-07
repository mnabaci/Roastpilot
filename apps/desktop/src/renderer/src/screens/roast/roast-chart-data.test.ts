import { READY_ROAST, type Reading } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
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
    // RoR starts at charge and waits for a full 30 s window of readings since charge.
    expect(ror?.points[0]?.t).toBeGreaterThanOrEqual(27);
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

  it('marks the turning point as TP', () => {
    const { markers } = roastChartData(
      {
        ...READY_ROAST,
        phase: 'roasting',
        chargedAtMs: 10_000,
        events: [
          { kind: 'charge', atMs: 10_000, bt: 180 },
          { kind: 'turning-point', atMs: 74_000, bt: 92.2 },
        ],
      },
      readings,
      RAW,
    );
    expect(markers.map((m) => [m.label, m.t])).toEqual([
      ['Charge', 0],
      ['TP', 64],
    ]);
  });

  it.each(['cool-end', 'end'] as const)(
    'every line stops at %s; later readings are not drawn',
    (kind) => {
      const { layers } = roastChartData(
        {
          ...READY_ROAST,
          phase: 'done',
          chargedAtMs: 10_000,
          events: [
            { kind: 'charge', atMs: 10_000, bt: 100 },
            { kind, atMs: 40_000, bt: 105 },
          ],
        },
        readings,
        RAW,
      );
      const last = (id: string) => layers.find((l) => l.id === id)?.points.at(-1)?.t;
      expect(last('bt')).toBe(30);
    },
  );

  it('draws an on/off drum at 0 or 100%, and a drum speed as it is', () => {
    const drumOf = (values: number[]) =>
      roastChartData(
        READY_ROAST,
        values.map((drum, i) => ({ atMs: i * 1_000, values: { bt: 100, drum } })),
        RAW,
      ).layers.find((l) => l.id === 'drum');
    expect(drumOf([0, 1, 1])).toMatchObject({
      label: 'Drum',
      axis: 'output',
      tone: 'neutral',
      step: true,
      points: [
        { t: 0, v: 0 },
        { t: 1, v: 100 },
        { t: 2, v: 100 },
      ],
    });
    expect(drumOf([60, 60])?.points).toEqual([
      { t: 0, v: 60 },
      { t: 1, v: 60 },
    ]);
  });

  it('has no drum line when no reading has the drum', () => {
    const { layers } = roastChartData(READY_ROAST, [{ atMs: 0, values: { bt: 100 } }], RAW);
    expect(layers.map((l) => l.id)).not.toContain('drum');
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

  it('draws RoR from charge to drop only, and leaves out values beyond the limits', () => {
    // 2 °C/min before charge, a 40 °C fall at charge, then 15 °C/min (the window still recovering),
    // and cooling after drop.
    const series: Reading[] = Array.from({ length: 181 }, (_, s) => ({
      atMs: s * 1000,
      values: { bt: s < 60 ? 150 + s / 30 : s < 150 ? 110 + (s - 60) / 4 : 132 - (s - 150) },
    }));
    const { layers } = roastChartData(
      {
        ...READY_ROAST,
        phase: 'cooling',
        preheatAtMs: 0,
        chargedAtMs: 60_000,
        droppedAtMs: 150_000,
        events: [
          { kind: 'charge', atMs: 60_000, bt: 150 },
          { kind: 'drop', atMs: 150_000, bt: 132 },
        ],
      },
      series,
      RAW,
    );
    const ror = layers.find((l) => l.id === 'ror')?.points ?? [];
    const drawn = ror.filter((p) => p.v !== null);
    expect(Math.min(...ror.map((p) => p.t))).toBeGreaterThanOrEqual(27);
    expect(Math.max(...ror.map((p) => p.t))).toBeLessThanOrEqual(90);
    expect(drawn.at(-1)?.v).toBeCloseTo(15, 0);
  });

  it('a RoR spike beyond the limits is a gap, not a point', () => {
    const series: Reading[] = Array.from({ length: 40 }, (_, s) => ({
      atMs: s * 1000,
      values: { bt: 100 + s * 2 },
    }));
    const { layers } = roastChartData(
      { ...READY_ROAST, phase: 'roasting', chargedAtMs: 0, events: [] },
      series,
      RAW,
    );
    const ror = layers.find((l) => l.id === 'ror')?.points ?? [];
    // 120 °C/min is far above 45: every point is left out.
    expect(ror.length).toBeGreaterThan(0);
    expect(ror.every((p) => p.v === null)).toBe(true);
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
