import { curveTargetC } from '@roastpilot/core';
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

  it('draws the plan as the smooth curve Auto follows, a point every 5 s', () => {
    const plan = [
      { tS: 0, c: 180 },
      { tS: 60, c: 92 },
      { tS: 300, c: 150 },
    ];
    const charged = { ...READY_ROAST, phase: 'roasting' as const, chargedAtMs: 10_000 };
    const drawn = roastChartData(charged, readings, { ...RAW, plan }).layers.find(
      (l) => l.id === 'plan',
    );
    expect(drawn?.points).toHaveLength(61);
    expect(drawn?.points.filter((p) => p.t % 5 !== 0)).toEqual([]);
    for (const p of drawn?.points ?? []) expect(p.v).toBeCloseTo(curveTargetC(plan, p.t) ?? 0, 9);
    // Flat out of the turning point: 92.05 °C 5 s after it, where a straight line gives 93.2.
    expect(drawn?.points.find((p) => p.t === 65)?.v).toBeCloseTo(92.05, 2);
  });
});
