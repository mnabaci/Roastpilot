import type { AutoTuning } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { heatControlFor, neededRor } from './heat-control';
import type { HeatInput } from './output-controller';

const TUNING: AutoTuning = {
  target: { kp: 2, ki: 0, kd: 0 },
  targetLimitPct: 20,
  curveFollow: {
    gains: { kp: 2, ki: 0, kd: 0 },
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
const CURVE = [
  { tS: 0, c: 100 },
  { tS: 600, c: 200 },
];
/** 150 → 165 °C in 75 s: 12 °C/min, inside 10–14. */
const TARGET = {
  mode: 'target',
  pct: 65,
  endC: 165,
  durationS: 75,
  rorMin: 10,
  rorMax: 14,
} as const;
/** At the start of the step, on course: 12 °C/min needed and 12 running. */
const ON_COURSE: HeatInput = {
  elapsedS: 300,
  phaseElapsedS: 0,
  dtS: 1,
  btC: 150,
  ror: 12,
  stallTripped: false,
  firstCracked: false,
};

describe('neededRor', () => {
  it('is the temperature to gain over the time left', () => {
    expect(neededRor(TARGET, 150, 0)).toBe(12);
    expect(neededRor(TARGET, 155, 25)).toBe(12);
  });

  it('asks for more when behind, up to the top of the range', () => {
    expect(neededRor(TARGET, 150, 15)).toBe(14);
    expect(neededRor(TARGET, 145, 0)).toBe(14);
  });

  it('asks for less when ahead, down to the bottom of the range', () => {
    expect(neededRor(TARGET, 160, 0)).toBe(10);
  });

  it('asks for the top with no time left and the temperature still short', () => {
    expect(neededRor(TARGET, 164, 75)).toBe(14);
    expect(neededRor(TARGET, 164, 500)).toBe(14);
  });

  it('asks for the bottom at or past the end temperature', () => {
    expect(neededRor(TARGET, 165, 10)).toBe(10);
    expect(neededRor(TARGET, 170, 500)).toBe(10);
  });
});

describe('fixed', () => {
  it('sends exactly the planned heat, whatever the roast does', () => {
    const control = heatControlFor({ mode: 'fixed', pct: 0 }, TUNING, CURVE);
    expect(control.next({ ...ON_COURSE, ror: -40, stallTripped: true })).toBe(0);
  });
});

describe('target', () => {
  it('starts from its estimate when on course', () => {
    expect(heatControlFor(TARGET, TUNING, CURVE).next(ON_COURSE)).toBe(65);
  });

  it('stays on its estimate until RoR first reaches the range', () => {
    const control = heatControlFor(TARGET, TUNING, CURVE);
    expect(control.next({ ...ON_COURSE, ror: 3 })).toBe(65);
    expect(control.next({ ...ON_COURSE, ror: 9.9 })).toBe(65);
  });

  it('corrects once RoR has reached the range, also when it leaves again', () => {
    const control = heatControlFor(TARGET, TUNING, CURVE);
    control.next({ ...ON_COURSE, ror: 10 });
    expect(control.next({ ...ON_COURSE, ror: 9 })).toBe(71);
  });

  it('adds heat when behind and takes it away when ahead', () => {
    const behind = heatControlFor(TARGET, TUNING, CURVE);
    expect(behind.next({ ...ON_COURSE, btC: 145 })).toBe(69);
    const ahead = heatControlFor(TARGET, TUNING, CURVE);
    expect(ahead.next({ ...ON_COURSE, btC: 160 })).toBe(61);
  });

  it('stays within ±20% of its estimate', () => {
    const control = heatControlFor(TARGET, TUNING, CURVE);
    control.next(ON_COURSE);
    expect(control.next({ ...ON_COURSE, ror: 10, btC: 100 })).toBe(73);
    expect(control.next({ ...ON_COURSE, ror: -40, btC: 100 })).toBe(85);
    expect(control.next({ ...ON_COURSE, ror: 80 })).toBe(45);
  });

  it('may add up to 30% while the stall guard holds, but takes no more away', () => {
    const control = heatControlFor(TARGET, TUNING, CURVE);
    expect(control.next({ ...ON_COURSE, ror: -40, stallTripped: true })).toBe(95);
    expect(control.next({ ...ON_COURSE, ror: 80, stallTripped: true })).toBe(45);
  });

  it('aims for at least the stall guard RoR until your first-crack tap', () => {
    // Development, 188 °C with 50 s left: the step alone would aim for 3.6 °C/min.
    const development = {
      mode: 'target',
      pct: 40,
      endC: 191,
      durationS: 94,
      rorMin: 3,
      rorMax: 7,
    } as const;
    const late = { ...ON_COURSE, btC: 188, phaseElapsedS: 44, ror: 5 };
    expect(heatControlFor(development, TUNING, CURVE).next(late)).toBe(40);
    const afterTap = heatControlFor(development, TUNING, CURVE);
    expect(afterTap.next({ ...late, firstCracked: true })).toBeCloseTo(40 + 2 * (3.6 - 5));
  });

  it('is maxed only at its correction limit or full heat', () => {
    const control = heatControlFor(TARGET, TUNING, CURVE);
    control.next(ON_COURSE);
    expect(control.maxed).toBe(false);
    control.next({ ...ON_COURSE, ror: -40 });
    expect(control.maxed).toBe(true);
    control.next({ ...ON_COURSE, ror: -40, stallTripped: true });
    expect(control.maxed).toBe(true);
    const hot = heatControlFor({ ...TARGET, pct: 95 }, TUNING, CURVE);
    hot.next(ON_COURSE);
    hot.next({ ...ON_COURSE, ror: 9 });
    expect(hot.maxed).toBe(true);
  });

  it('a fixed step has no heat to add', () => {
    expect(heatControlFor({ mode: 'fixed', pct: 50 }, TUNING, CURVE).maxed).toBe(true);
  });

  it('holds its last value with no RoR or temperature', () => {
    const control = heatControlFor(TARGET, TUNING, CURVE);
    control.next(ON_COURSE);
    const held = control.next({ ...ON_COURSE, ror: 11 });
    expect(control.next({ ...ON_COURSE, ror: undefined })).toBe(held);
    expect(control.next({ ...ON_COURSE, btC: undefined })).toBe(held);
  });
});

describe('follow', () => {
  it('starts from its estimate and trims it with the curve-following tuning', () => {
    const control = heatControlFor({ mode: 'follow', pct: 50 }, TUNING, CURVE);
    // The curve climbs 10 °C/min; on it at 10, nothing to change.
    expect(control.next({ ...ON_COURSE, btC: 150, ror: 10 })).toBe(50);
    // Its correction moves the heater at most 5% per 10 s.
    expect(control.next({ ...ON_COURSE, btC: 150, ror: 0 })).toBe(50.5);
  });
});
