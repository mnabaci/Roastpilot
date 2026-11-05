import type { AutoTuning } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { heatControlFor, targetRor, type HeatInput } from './heat-control';

const TUNING: AutoTuning = {
  trim: { kp: 2, ki: 0, kd: 0 },
  trimLimitPct: 10,
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
const TRIM = { mode: 'trim', pct: 65, rorMin: 12, rorMax: 14 } as const;
/** BT exactly on the curve at 300 s. */
const ON_CURVE: HeatInput = { elapsedS: 300, dtS: 1, btC: 150, ror: 13, stallTripped: false };

describe('targetRor', () => {
  const band = { rorMin: 12, rorMax: 14 };

  it('aims mid-band on the curve', () => {
    expect(targetRor(band, 0)).toBe(13);
  });

  it('aims for the top when 2 °C or more below the curve', () => {
    expect(targetRor(band, -2)).toBe(14);
    expect(targetRor(band, -20)).toBe(14);
  });

  it('aims for the bottom when 2 °C or more above the curve', () => {
    expect(targetRor(band, 2)).toBe(12);
    expect(targetRor(band, 20)).toBe(12);
  });

  it('moves in proportion in between', () => {
    expect(targetRor(band, 1)).toBe(12.5);
  });
});

describe('fixed', () => {
  it('sends exactly the planned heat, whatever the roast does', () => {
    const control = heatControlFor({ mode: 'fixed', pct: 0 }, TUNING, CURVE);
    expect(control.next({ ...ON_CURVE, ror: -40, stallTripped: true })).toBe(0);
  });
});

describe('trim', () => {
  it('stays on plan until RoR first reaches its band', () => {
    const control = heatControlFor(TRIM, TUNING, CURVE);
    expect(control.next({ ...ON_CURVE, ror: 3 })).toBe(65);
    expect(control.next({ ...ON_CURVE, ror: 11.9 })).toBe(65);
  });

  it('corrects once RoR has reached its band, also when it leaves again', () => {
    const control = heatControlFor(TRIM, TUNING, CURVE);
    control.next({ ...ON_CURVE, ror: 12 });
    expect(control.next({ ...ON_CURVE, ror: 11 })).toBe(69);
  });

  it('adds no heat on the curve at mid-band', () => {
    const control = heatControlFor(TRIM, TUNING, CURVE);
    expect(control.next(ON_CURVE)).toBe(65);
  });

  it('adds heat when behind the curve inside the band', () => {
    const control = heatControlFor(TRIM, TUNING, CURVE);
    expect(control.next({ ...ON_CURVE, btC: 145 })).toBe(67);
  });

  it('takes heat away when ahead of the curve inside the band', () => {
    const control = heatControlFor(TRIM, TUNING, CURVE);
    expect(control.next({ ...ON_CURVE, btC: 155 })).toBe(63);
  });

  it('stays within ±10% of the plan', () => {
    const control = heatControlFor(TRIM, TUNING, CURVE);
    control.next(ON_CURVE);
    expect(control.next({ ...ON_CURVE, ror: 0 })).toBe(75);
    expect(control.next({ ...ON_CURVE, ror: 40 })).toBe(55);
  });

  it('may add up to 20% while the stall guard holds, but takes no more away', () => {
    const control = heatControlFor(TRIM, TUNING, CURVE);
    expect(control.next({ ...ON_CURVE, ror: 0, stallTripped: true })).toBe(85);
    expect(control.next({ ...ON_CURVE, ror: 40, stallTripped: true })).toBe(55);
  });

  it('holds its last value with no RoR or temperature', () => {
    const control = heatControlFor(TRIM, TUNING, CURVE);
    control.next(ON_CURVE);
    const held = control.next({ ...ON_CURVE, ror: 12 });
    expect(control.next({ ...ON_CURVE, ror: undefined })).toBe(held);
    expect(control.next({ ...ON_CURVE, btC: undefined })).toBe(held);
  });
});

describe('follow', () => {
  const FOLLOW = { mode: 'follow', pct: 50 } as const;

  it('starts from its planned value on the curve', () => {
    expect(heatControlFor(FOLLOW, TUNING, CURVE).next(ON_CURVE)).toBe(50);
  });

  it('adds heat below the curve and takes it away above', () => {
    const control = heatControlFor(FOLLOW, TUNING, CURVE);
    expect(control.next({ ...ON_CURVE, btC: 148 })).toBe(60);
    expect(control.next({ ...ON_CURVE, btC: 152 })).toBe(40);
  });

  it('stays between 0 and 100', () => {
    const control = heatControlFor(FOLLOW, TUNING, CURVE);
    expect(control.next({ ...ON_CURVE, btC: 50 })).toBe(100);
    expect(control.next({ ...ON_CURVE, btC: 250 })).toBe(0);
  });

  it('holds its last value with no temperature', () => {
    const control = heatControlFor(FOLLOW, TUNING, CURVE);
    control.next({ ...ON_CURVE, btC: 148 });
    expect(control.next({ ...ON_CURVE, btC: undefined })).toBe(60);
  });

  it('holds its value with no curve to follow', () => {
    expect(heatControlFor(FOLLOW, TUNING, []).next(ON_CURVE)).toBe(50);
  });
});
