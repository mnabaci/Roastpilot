import { PROFILE_SCHEMA_VERSION, type AutoProfile, type AutoTuning } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { MAX_STEP_S, RoastRun } from './roast-run';

const PROFILE: AutoProfile = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  id: 'light-curve',
  name: 'Light · Curve',
  needsCalibration: true,
  batchG: 385,
  chargeC: 180,
  dryEndC: 150,
  devTimeS: 90,
  capC: 200,
  curve: [
    { tS: 0, c: 180 },
    { tS: 60, c: 92 },
    { tS: 600, c: 190 },
  ],
  phases: [
    { name: 'Soak', heat: { mode: 'fixed', pct: 0 }, fanPct: 30, next: { on: 'time', afterS: 60 } },
    {
      name: 'Heat on',
      heat: { mode: 'target', pct: 85, endC: 150, durationS: 245, rorMin: 14, rorMax: 18 },
      fanPct: 30,
      next: { on: 'bt', c: 150, backupS: 390 },
    },
    { name: 'Follow', heat: { mode: 'follow', pct: 50 }, fanPct: 80, next: { on: 'end' } },
  ],
};
const TUNING: AutoTuning = {
  target: { kp: 0, ki: 0.1, kd: 0 },
  targetLimitPct: 20,
  curveFollow: {
    gains: { kp: 0, ki: 0.1, kd: 0 },
    limitPct: 20,
    lookAheadS: 30,
    pullPerC: 0.3,
    slewPctPer10s: 5,
  },
  preheat: { kp: 1, ki: 0, kd: 0 },
  preheatFanPct: 30,
  holdS: 150,
  chargeCutS: 5,
};

const tick = (run: RoastRun, s: number, btC: number) =>
  run.tick({ nowMs: s * 1_000, btC, ror: 10, firstCrackAtMs: null });

describe('RoastRun', () => {
  it('slews the heater from one curve phase to the next, but leaves the soak at once', () => {
    const curves: AutoProfile = {
      ...PROFILE,
      phases: [
        {
          name: 'Soak',
          heat: { mode: 'fixed', pct: 0 },
          fanPct: 30,
          next: { on: 'time', afterS: 60 },
        },
        {
          name: 'Heat on',
          heat: { mode: 'follow', pct: 85 },
          fanPct: 30,
          next: { on: 'time', afterS: 120 },
        },
        { name: 'Maillard', heat: { mode: 'follow', pct: 50 }, fanPct: 65, next: { on: 'end' } },
      ],
    };
    const run = new RoastRun(curves, TUNING, 0);
    // RoR 3 keeps the correction out (it waits for RoR to climb), so only the slew moves it.
    const at = (s: number) =>
      run.tick({ nowMs: s * 1_000, btC: 92 + (s - 60) * 0.18, ror: 3, firstCrackAtMs: null })
        .heaterPct;
    for (let s = 1; s < 60; s++) at(s);
    expect(at(60)).toBe(85);
    for (let s = 61; s < 120; s++) at(s);
    expect(at(120)).toBe(84.5);
    for (let s = 121; s < 129; s++) at(s);
    expect(at(129)).toBe(80);
  });

  it(`counts a gap of more than ${String(MAX_STEP_S)} s as ${String(MAX_STEP_S)} s`, () => {
    // Follow phase on a curve climbing 30 °C/min, RoR 10: the heater climbs at its 0.5% a second.
    // Points in a line from 1:30 keep the smooth curve straight there.
    const steep = {
      ...PROFILE,
      curve: [
        { tS: 0, c: 180 },
        { tS: 60, c: 150 },
        { tS: 90, c: 165 },
        { tS: 120, c: 180 },
        { tS: 900, c: 570 },
      ],
    };
    const heaterAfter = (gapS: number) => {
      const run = new RoastRun(steep, TUNING, 0);
      run.catchUp([
        { atMs: 100_000, btC: 150 },
        { atMs: 101_000, btC: 150 },
      ]);
      [102, 103, 104].forEach((s) => tick(run, s, 150));
      return tick(run, 104 + gapS, 150).heaterPct;
    };
    expect(heaterAfter(1)).toBe(52);
    expect(heaterAfter(300)).toBe(heaterAfter(MAX_STEP_S));
    expect(heaterAfter(300)).toBe(53);
  });

  it('catches up quietly, timing the phase from when it really began', () => {
    const run = new RoastRun(PROFILE, TUNING, 0);
    run.catchUp([
      { atMs: 30_000, btC: 120 },
      { atMs: 61_000, btC: 95 },
      { atMs: 62_000, btC: 96 },
    ]);
    expect(run.phaseName).toBe('Heat on');
    const next = tick(run, 63, 97);
    expect(next.events).toEqual([]);
  });

  it('does not move on for one bad reading at a trigger', () => {
    const run = new RoastRun(PROFILE, TUNING, 0);
    run.catchUp([
      { atMs: 100_000, btC: 140 },
      { atMs: 101_000, btC: 141 },
    ]);
    expect(tick(run, 102, 230).events).toEqual([]);
    expect(run.phaseName).toBe('Heat on');
  });
});
