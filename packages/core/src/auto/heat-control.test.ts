import type { AutoTuning } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { heatControlFor, neededRor, type HeatInput } from './heat-control';

const TUNING: AutoTuning = {
  target: { kp: 2, ki: 0, kd: 0 },
  targetLimitPct: 20,
  follow: { kp: 5, ki: 0, kd: 0 },
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

  it('holds its last value with no RoR or temperature', () => {
    const control = heatControlFor(TARGET, TUNING, CURVE);
    control.next(ON_COURSE);
    const held = control.next({ ...ON_COURSE, ror: 11 });
    expect(control.next({ ...ON_COURSE, ror: undefined })).toBe(held);
    expect(control.next({ ...ON_COURSE, btC: undefined })).toBe(held);
  });
});

describe('follow', () => {
  const FOLLOW = { mode: 'follow', pct: 50 } as const;

  it('starts from its planned value on the curve', () => {
    expect(heatControlFor(FOLLOW, TUNING, CURVE).next(ON_COURSE)).toBe(50);
  });

  it('adds heat below the curve and takes it away above', () => {
    const control = heatControlFor(FOLLOW, TUNING, CURVE);
    expect(control.next({ ...ON_COURSE, btC: 148 })).toBe(60);
    expect(control.next({ ...ON_COURSE, btC: 152 })).toBe(40);
  });

  it('stays between 0 and 100', () => {
    const control = heatControlFor(FOLLOW, TUNING, CURVE);
    expect(control.next({ ...ON_COURSE, btC: 50 })).toBe(100);
    expect(control.next({ ...ON_COURSE, btC: 250 })).toBe(0);
  });

  it('holds its last value with no temperature', () => {
    const control = heatControlFor(FOLLOW, TUNING, CURVE);
    control.next({ ...ON_COURSE, btC: 148 });
    expect(control.next({ ...ON_COURSE, btC: undefined })).toBe(60);
  });

  it('holds its value with no curve to follow', () => {
    expect(heatControlFor(FOLLOW, TUNING, []).next(ON_COURSE)).toBe(50);
  });
});
