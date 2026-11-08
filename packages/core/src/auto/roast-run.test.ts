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

/** Soak, then two curve phases: the heater carries from one curve phase to the next. */
const CURVES: AutoProfile = {
  ...PROFILE,
  phases: [
    { name: 'Soak', heat: { mode: 'fixed', pct: 0 }, fanPct: 30, next: { on: 'time', afterS: 60 } },
    {
      name: 'Heat on',
      heat: { mode: 'follow', pct: 85 },
      fanPct: 30,
      next: { on: 'time', afterS: 120 },
    },
    { name: 'Maillard', heat: { mode: 'follow', pct: 50 }, fanPct: 65, next: { on: 'end' } },
  ],
};

/** RoR 3 keeps the correction out (it waits for RoR to climb), so only the slew moves it. */
const curveTick = (run: RoastRun) => (s: number) =>
  run.tick({ nowMs: s * 1_000, btC: 92 + (s - 60) * 0.18, ror: 3, firstCrackAtMs: null }).heaterPct;

describe('RoastRun', () => {
  it('slews the heater from one curve phase to the next, but leaves the soak at once', () => {
    const run = new RoastRun(CURVES, TUNING, 0);
    const at = curveTick(run);
    for (let s = 1; s < 60; s++) at(s);
    expect(at(60)).toBe(85);
    for (let s = 61; s < 120; s++) at(s);
    expect(at(120)).toBe(84.5);
    for (let s = 121; s < 129; s++) at(s);
    expect(at(129)).toBe(80);
  });

  it('after Resume auto with no heater reading, a curve phase starts on its estimate', () => {
    const run = new RoastRun(CURVES, TUNING, 0);
    const at = curveTick(run);
    for (let s = 1; s < 120; s++) at(s);
    // Auto was stopped, so the last heater it worked out never reached the roaster.
    run.restartControl();
    expect(at(120)).toBe(50);
  });

  it('after Resume auto, a curve phase slews from the heater the roaster has, not a jump', () => {
    const run = new RoastRun(CURVES, TUNING, 0);
    const at = curveTick(run);
    for (let s = 1; s < 125; s++) at(s);
    // You had the heater at 30 % by hand; Maillard's estimate is 50 %.
    run.restartControl(30);
    expect(at(125)).toBe(30.5);
    for (let s = 126; s < 134; s++) at(s);
    expect(at(134)).toBe(35);
  });

  it('slews down too, from a heater above the estimate', () => {
    const run = new RoastRun(CURVES, TUNING, 0);
    const at = curveTick(run);
    for (let s = 1; s < 125; s++) at(s);
    run.restartControl(90);
    expect(at(125)).toBe(89.5);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, undefined])(
    'a heater reading of %s counts as none: the estimate',
    (reading) => {
      const run = new RoastRun(CURVES, TUNING, 0);
      const at = curveTick(run);
      for (let s = 1; s < 125; s++) at(s);
      run.restartControl(reading);
      expect(at(125)).toBe(50);
    },
  );

  it('keeps a reported heater within 0–100 %', () => {
    const run = new RoastRun(CURVES, TUNING, 0);
    const at = curveTick(run);
    for (let s = 1; s < 125; s++) at(s);
    run.restartControl(140);
    expect(at(125)).toBe(99.5);
  });

  it('in the soak, Resume auto keeps the soak heater: nothing to slew', () => {
    const run = new RoastRun(CURVES, TUNING, 0);
    const at = curveTick(run);
    for (let s = 1; s < 30; s++) at(s);
    run.restartControl(60);
    expect(at(30)).toBe(0);
    // Out of the soak, the curve phase still starts at its estimate at once.
    for (let s = 31; s < 60; s++) at(s);
    expect(at(60)).toBe(85);
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
    expect(run.phaseIndex).toBe(1);
    expect(run.phaseStartedS).toBe(61);
    const next = tick(run, 63, 97);
    expect(next.events).toEqual([]);
  });

  describe('without a soak', () => {
    const NO_SOAK: AutoProfile = { ...CURVES, phases: CURVES.phases.slice(1) };

    it('runs the first step from charge, on its own heat', () => {
      const run = new RoastRun(NO_SOAK, TUNING, 0);
      expect(run.phaseName).toBe('Heat on');
      expect(curveTick(run)(1)).toBe(85);
    });

    it('records dry end once BT has dipped and climbed back, not at charge', () => {
      const run = new RoastRun(NO_SOAK, TUNING, 0);
      // BT is settled over three readings, so each temperature holds for three.
      const series = [180, 160, 120, 95, 130, 150].flatMap((c) => [c, c, c]);
      const events = series.map((c, i) => tick(run, i + 1, c).events);
      expect(events.flat().filter((e) => e.kind === 'dry-end')).toHaveLength(1);
      expect(events.findIndex((e) => e.some((x) => x.kind === 'dry-end'))).toBe(16);
    });

    it('has the stall guard watching from charge', () => {
      const run = new RoastRun(NO_SOAK, TUNING, 0);
      const at = (s: number, ror: number) =>
        run.tick({ nowMs: s * 1_000, btC: 120, ror, firstCrackAtMs: null });
      at(1, 10);
      expect(at(2, 2).events).toContainEqual({ kind: 'stall-guard', tripped: true });
    });
  });

  it('keeps the stall guard out of the soak', () => {
    const run = new RoastRun(CURVES, TUNING, 0);
    const at = (s: number, ror: number) =>
      run.tick({ nowMs: s * 1_000, btC: 120, ror, firstCrackAtMs: null });
    at(1, 10);
    expect(at(2, 2).events).toEqual([]);
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
