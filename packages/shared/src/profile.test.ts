import { describe, expect, it } from 'vitest';
import { AutoProfileSchema, PROFILE_SCHEMA_VERSION, type AutoProfile } from './profile';

const profile: AutoProfile = {
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
    { tS: 60, c: 92 },
  ],
  phases: [
    { name: 'Soak', heat: { mode: 'fixed', pct: 0 }, fanPct: 30, next: { on: 'time', afterS: 60 } },
    {
      name: 'Heat on',
      heat: { mode: 'trim', pct: 85, rorMin: 14, rorMax: 18 },
      fanPct: 30,
      next: { on: 'bt', c: 150, backupS: 390 },
    },
    { name: 'Finish', heat: { mode: 'follow', pct: 40 }, fanPct: 80, next: { on: 'end' } },
  ],
};

describe('AutoProfileSchema', () => {
  it('accepts a profile whose last phase ends with the end rule', () => {
    expect(AutoProfileSchema.parse(profile)).toEqual(profile);
  });

  it('refuses a last phase that waits for another phase', () => {
    const phases = profile.phases.slice(0, 2);
    expect(AutoProfileSchema.safeParse({ ...profile, phases }).success).toBe(false);
  });

  it('refuses an end rule before the last phase', () => {
    const [first, second, last] = profile.phases;
    const early = { ...second, next: { on: 'end' } };
    const phases = [first, early, last];
    expect(AutoProfileSchema.safeParse({ ...profile, phases }).success).toBe(false);
  });

  it('refuses curve points that go back in time', () => {
    const curve = [
      { tS: 60, c: 92 },
      { tS: 30, c: 100 },
    ];
    expect(AutoProfileSchema.safeParse({ ...profile, curve }).success).toBe(false);
  });

  it('refuses a heater value outside 0–100', () => {
    const [first, ...rest] = profile.phases;
    const hot = { ...first, heat: { mode: 'fixed', pct: 120 } };
    expect(AutoProfileSchema.safeParse({ ...profile, phases: [hot, ...rest] }).success).toBe(false);
  });

  it('refuses an upside-down RoR band', () => {
    const [first, second, last] = profile.phases;
    const flipped = { ...second, heat: { mode: 'trim', pct: 85, rorMin: 18, rorMax: 14 } };
    const phases = [first, flipped, last];
    expect(AutoProfileSchema.safeParse({ ...profile, phases }).success).toBe(false);
  });

  it('refuses a saved format from a different version', () => {
    expect(AutoProfileSchema.safeParse({ ...profile, schemaVersion: 99 }).success).toBe(false);
  });
});
