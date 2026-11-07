import type { CurveFollow } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { followAimRor, followControl } from './follow-control';
import type { HeatInput } from './output-controller';

/**
 * A straight 12 °C/min to 2:30 (three points in a line keep the smooth curve straight), bending
 * through a knee at 5:00 (8.3 °C/min there) towards 6 °C/min, which carries on past 10:00.
 */
const CURVE = [
  { tS: 0, c: 100 },
  { tS: 150, c: 130 },
  { tS: 300, c: 160 },
  { tS: 600, c: 190 },
];
/** Round numbers: the correction is 2% per °C/min of error, at once. */
const TUNING: CurveFollow = {
  gains: { kp: 2, ki: 0, kd: 0 },
  limitPct: 20,
  lookAheadS: 30,
  pullPerC: 0.3,
  slewPctPer10s: 5,
};
const FOLLOW = { mode: 'follow', pct: 50 } as const;
/** 1:40, on the curve at 120 °C and rising at its 12 °C/min. */
const ON_CURVE: HeatInput = {
  elapsedS: 100,
  phaseElapsedS: 40,
  dtS: 1,
  btC: 120,
  ror: 12,
  stallTripped: false,
  firstCracked: false,
};

/** The heater after `seconds` readings a second apart, each `input`. */
function run(control: ReturnType<typeof followControl>, input: HeatInput, seconds: number) {
  const heater: number[] = [];
  for (let s = 0; s < seconds; s += 1) heater.push(control.next(input));
  return heater;
}

describe('followAimRor', () => {
  const AT = { elapsedS: 100, btC: 120, firstCracked: false };

  it("is the curve's own RoR 30 s ahead when BT is on it", () => {
    expect(followAimRor(CURVE, TUNING, AT)).toBeCloseTo(12, 9);
  });

  it('pulls 0.3 °C/min per °C back towards the curve', () => {
    expect(followAimRor(CURVE, TUNING, { ...AT, btC: 110 })).toBeCloseTo(15);
    expect(followAimRor(CURVE, TUNING, { ...AT, btC: 130 })).toBeCloseTo(9);
  });

  it('sees a knee coming 30 s ahead', () => {
    // At 4:40 the curve (156.9 °C) climbs 10.1 °C/min, at 5:10 only 8.0; BT is 0.08 °C ahead.
    const atKnee = { ...AT, elapsedS: 280, btC: 157 };
    expect(followAimRor(CURVE, TUNING, atKnee)).toBeCloseTo(7.985, 3);
    expect(followAimRor(CURVE, { ...TUNING, lookAheadS: 0 }, atKnee)).toBeCloseTo(10.057, 3);
  });

  it('carries the last slope on past the last point', () => {
    expect(followAimRor(CURVE, TUNING, { ...AT, elapsedS: 700, btC: 200 })).toBeCloseTo(6);
  });

  it('stays within 0–30, and at 5 or more until your first-crack tap', () => {
    const farAhead = { ...AT, btC: 160 };
    expect(followAimRor(CURVE, TUNING, farAhead)).toBe(5);
    expect(followAimRor(CURVE, TUNING, { ...farAhead, firstCracked: true })).toBe(0);
    expect(followAimRor(CURVE, TUNING, { ...AT, btC: 50 })).toBe(30);
  });

  it('has no aim with no curve or a bad temperature', () => {
    expect(followAimRor([], TUNING, AT)).toBeUndefined();
    expect(followAimRor(CURVE, TUNING, { ...AT, btC: Number.NaN })).toBeUndefined();
  });
});

describe('followControl', () => {
  it('after another curve phase, starts where it left the heater and slews to its estimate', () => {
    const control = followControl({ mode: 'follow', pct: 50 }, TUNING, CURVE, 65);
    const heater = run(control, { ...ON_CURVE, ror: 3 }, 30);
    expect(heater[0]).toBe(64.5);
    expect(heater[9]).toBe(60);
    expect(heater.at(-1)).toBe(50);
  });

  it('stays on its estimate while the roast is on the curve', () => {
    const control = followControl(FOLLOW, TUNING, CURVE);
    for (const pct of run(control, ON_CURVE, 30)) expect(pct).toBeCloseTo(50, 9);
  });

  it('behind the curve, adds heat no faster than 5% per 10 s', () => {
    // 10 °C behind: aim 15, RoR 12, so 6% more, reached in 12 s.
    const heater = run(followControl(FOLLOW, TUNING, CURVE), { ...ON_CURVE, btC: 110 }, 20);
    expect(heater[0]).toBe(50.5);
    expect(heater[9]).toBeCloseTo(55);
    expect(heater.at(-1)).toBeCloseTo(56);
  });

  it('ahead of the curve, takes heat away no faster than 5% per 10 s', () => {
    const heater = run(followControl(FOLLOW, TUNING, CURVE), { ...ON_CURVE, btC: 130 }, 20);
    expect(heater[0]).toBe(49.5);
    expect(heater[9]).toBeCloseTo(45);
    expect(heater.at(-1)).toBeCloseTo(44);
  });

  it('eases off before a knee in the curve', () => {
    const control = followControl(FOLLOW, TUNING, CURVE);
    // At 4:40, RoR 12, with about 8 the aim 30 s ahead: 8% less, on its way down.
    const heater = run(control, { ...ON_CURVE, elapsedS: 280, btC: 157 }, 10);
    expect(heater.at(-1)).toBeCloseTo(45);
  });

  it('moves a long step at most by the slew of that step', () => {
    const control = followControl(FOLLOW, TUNING, CURVE);
    expect(control.next({ ...ON_CURVE, btC: 110, dtS: 3 })).toBeCloseTo(51.5);
  });

  it('stays within ±20% of its estimate, and +30% while the stall guard trips', () => {
    const control = followControl(FOLLOW, TUNING, CURVE);
    const stalling = { ...ON_CURVE, ror: -5 };
    control.next(ON_CURVE);
    expect(run(control, stalling, 60).at(-1)).toBe(70);
    expect(run(control, { ...stalling, stallTripped: true }, 60).at(-1)).toBe(80);
    expect(run(control, { ...ON_CURVE, ror: 40 }, 200).at(-1)).toBe(30);
  });

  it('never leaves 0–100', () => {
    const hot = followControl({ mode: 'follow', pct: 95 }, TUNING, CURVE);
    hot.next(ON_CURVE);
    expect(run(hot, { ...ON_CURVE, ror: 0 }, 60).at(-1)).toBe(100);
    const cold = followControl({ mode: 'follow', pct: 5 }, TUNING, CURVE);
    expect(run(cold, { ...ON_CURVE, ror: 40 }, 60).at(-1)).toBe(0);
  });

  it('aims for at least 5 °C/min until your first-crack tap', () => {
    // Far ahead: the curve alone would aim for 0. RoR 5 is enough before the tap, too much after.
    const farAhead = { ...ON_CURVE, btC: 160, ror: 5 };
    expect(run(followControl(FOLLOW, TUNING, CURVE), farAhead, 1)).toEqual([50]);
    const afterTap = followControl(FOLLOW, TUNING, CURVE);
    expect(afterTap.next({ ...farAhead, firstCracked: true })).toBe(49.5);
  });

  it('waits for RoR to climb out of the turning point before it corrects', () => {
    const control = followControl(FOLLOW, TUNING, CURVE);
    expect(run(control, { ...ON_CURVE, ror: -10 }, 10).every((pct) => pct === 50)).toBe(true);
    control.next({ ...ON_CURVE, ror: 5 });
    expect(control.next({ ...ON_CURVE, ror: 4 })).toBeGreaterThan(50);
  });

  it('corrects at once while the stall guard trips, climbed out or not', () => {
    const control = followControl(FOLLOW, TUNING, CURVE);
    expect(control.next({ ...ON_CURVE, ror: 2, stallTripped: true })).toBe(50.5);
  });

  it('holds its last value with no RoR or temperature', () => {
    const control = followControl(FOLLOW, TUNING, CURVE);
    const held = control.next({ ...ON_CURVE, btC: 110 });
    expect(control.next({ ...ON_CURVE, ror: undefined })).toBe(held);
    expect(control.next({ ...ON_CURVE, ror: Number.NaN })).toBe(held);
    expect(control.next({ ...ON_CURVE, btC: undefined })).toBe(held);
    expect(control.next({ ...ON_CURVE, btC: Number.NaN })).toBe(held);
  });

  it('holds its estimate with no curve to follow', () => {
    expect(followControl(FOLLOW, TUNING, []).next({ ...ON_CURVE, btC: 110 })).toBe(50);
  });

  it('holds with a bad time step', () => {
    const control = followControl(FOLLOW, TUNING, CURVE);
    expect(control.next({ ...ON_CURVE, btC: 110, dtS: Number.NaN })).toBe(50);
    expect(control.next({ ...ON_CURVE, btC: 110, dtS: -1 })).toBe(50);
  });

  it('is maxed only once the heater has reached its ceiling', () => {
    const control = followControl(FOLLOW, TUNING, CURVE);
    control.next(ON_CURVE);
    expect(control.maxed).toBe(false);
    run(control, { ...ON_CURVE, ror: 0 }, 39);
    // The correction is at +20%, but the heater is still on its way: there is heat to come.
    expect(control.maxed).toBe(false);
    control.next({ ...ON_CURVE, ror: 0 });
    expect(control.maxed).toBe(true);
    control.next({ ...ON_CURVE, ror: 0, stallTripped: true });
    expect(control.maxed).toBe(false);
    const full = followControl({ mode: 'follow', pct: 95 }, TUNING, CURVE);
    full.next(ON_CURVE);
    run(full, { ...ON_CURVE, ror: 0 }, 10);
    expect(full.maxed).toBe(true);
  });
});
