import { PROFILE_SCHEMA_VERSION, type AutoProfile } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { DryEndWatch } from './dry-end-watch';

const SOAK = {
  name: 'Soak',
  heat: { mode: 'fixed', pct: 0 },
  fanPct: 30,
  next: { on: 'time', afterS: 60 },
} as const;
const HEAT_ON = {
  name: 'Heat on',
  heat: { mode: 'follow', pct: 85 },
  fanPct: 30,
  next: { on: 'end' },
} as const;

const PROFILE: AutoProfile = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  id: 'p',
  name: 'P',
  needsCalibration: true,
  batchG: 385,
  chargeC: 180,
  dryEndC: 150,
  devTimeS: 90,
  capC: 200,
  curve: [
    { tS: 0, c: 180 },
    { tS: 60, c: 92 },
  ],
  phases: [SOAK, HEAT_ON],
};
const NO_SOAK: AutoProfile = { ...PROFILE, phases: [HEAT_ON] };

describe('DryEndWatch', () => {
  it('ignores the hot reading at charge and the fall through dry end', () => {
    const watch = new DryEndWatch(NO_SOAK);
    expect([180, 160, 150, 140].map((c) => watch.next(0, c))).toEqual([false, false, false, false]);
  });

  it('without a soak, counts once BT has dipped and climbs back, in the first step', () => {
    const watch = new DryEndWatch(NO_SOAK);
    [180, 120, 95, 149].forEach((c) => watch.next(0, c));
    expect(watch.next(0, 150)).toBe(true);
  });

  it('counts once only', () => {
    const watch = new DryEndWatch(NO_SOAK);
    [180, 120, 150].forEach((c) => watch.next(0, c));
    expect(watch.next(0, 155)).toBe(false);
  });

  it('never counts in the soak', () => {
    const watch = new DryEndWatch(PROFILE);
    watch.next(0, 120);
    expect(watch.next(0, 150)).toBe(false);
    expect(watch.next(1, 150)).toBe(true);
  });

  it('after the soak, still waits for the dip when BT is above it', () => {
    const watch = new DryEndWatch(PROFILE);
    expect(watch.next(1, 170)).toBe(false);
    watch.next(1, 100);
    expect(watch.next(1, 150)).toBe(true);
  });

  it('skips a lost reading', () => {
    const watch = new DryEndWatch(NO_SOAK);
    watch.next(0, 120);
    expect(watch.next(0, undefined)).toBe(false);
    expect(watch.next(0, 150)).toBe(true);
  });
});
