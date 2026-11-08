import { PROFILE_SCHEMA_VERSION, type AutoProfile } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { plannedCurve } from './steps-curve';

const PROFILE: AutoProfile = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  id: 'light-steps',
  name: 'Light · Steps',
  needsCalibration: true,
  batchG: 385,
  chargeC: 180,
  dryEndC: 150,
  devTimeS: 90,
  capC: 200,
  curve: [
    { tS: 0, c: 180 },
    { tS: 64, c: 92 },
    { tS: 400, c: 170 },
  ],
  phases: [
    { name: 'Soak', heat: { mode: 'fixed', pct: 0 }, fanPct: 30, next: { on: 'time', afterS: 60 } },
    {
      name: 'Heat on',
      heat: { mode: 'target', pct: 85, endC: 150, durationS: 245, rorMin: 14, rorMax: 18 },
      fanPct: 30,
      next: { on: 'bt', c: 150, backupS: 390 },
    },
    {
      name: 'Development',
      heat: { mode: 'target', pct: 40, endC: 191, durationS: 94, rorMin: 3, rorMax: 7 },
      fanPct: 80,
      next: { on: 'end' },
    },
  ],
};

describe('plannedCurve', () => {
  it('runs charge, turning point, each step, then the cap at the planned drop', () => {
    expect(plannedCurve(PROFILE)).toEqual([
      { tS: 0, c: 180 },
      { tS: 64, c: 92 },
      { tS: 305, c: 150 },
      { tS: 399, c: 191 },
      { tS: 489, c: 200 },
    ]);
  });

  it('moves with the soak', () => {
    const [soak, ...rest] = PROFILE.phases;
    if (!soak) throw new Error('no soak');
    const longer = { ...soak, next: { on: 'time', afterS: 90 } } as const;
    const curve = plannedCurve({ ...PROFILE, phases: [longer, ...rest] });
    expect(curve[2]).toEqual({ tS: 335, c: 150 });
  });

  it('starts the first step at charge without a soak', () => {
    const curve = plannedCurve({ ...PROFILE, phases: PROFILE.phases.slice(1) });
    expect(curve.slice(1, 4)).toEqual([
      { tS: 64, c: 92 },
      { tS: 245, c: 150 },
      { tS: 339, c: 191 },
    ]);
  });

  it('keeps the curve it was given with no target steps', () => {
    const phases = [
      { name: 'Only', heat: { mode: 'follow', pct: 50 }, fanPct: 30, next: { on: 'end' } },
    ] as const;
    const profile = { ...PROFILE, phases: [...phases] };
    expect(plannedCurve(profile)).toBe(profile.curve);
  });
});
