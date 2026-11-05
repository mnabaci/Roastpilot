import { PROFILE_SCHEMA_VERSION, type AutoProfile, type ProfileEntry } from '@roastpilot/shared';

const BASE = {
  schemaVersion: PROFILE_SCHEMA_VERSION as typeof PROFILE_SCHEMA_VERSION,
  needsCalibration: true,
  batchG: 385,
  chargeC: 180,
  dryEndC: 150,
  devTimeS: 90,
  capC: 200,
  curve: [
    { tS: 0, c: 180 },
    { tS: 64, c: 92 },
    { tS: 305, c: 150 },
    { tS: 600, c: 197 },
  ],
};

const SOAK: AutoProfile['phases'][number] = {
  name: 'Soak',
  heat: { mode: 'fixed', pct: 0 },
  fanPct: 30,
  next: { on: 'time', afterS: 60 },
};

/** A step profile in the built-in's shape. */
export const STEPS: AutoProfile = {
  ...BASE,
  id: 'light-steps',
  name: 'Light · Steps',
  phases: [
    SOAK,
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

/** A curve profile in the built-in's shape. */
export const CURVE: AutoProfile = {
  ...BASE,
  id: 'light-curve',
  name: 'Light · Curve',
  phases: [
    SOAK,
    {
      name: 'Heat on',
      heat: { mode: 'follow', pct: 85 },
      fanPct: 30,
      next: { on: 'bt', c: 150, backupS: 390 },
    },
    { name: 'Development', heat: { mode: 'follow', pct: 40 }, fanPct: 80, next: { on: 'end' } },
  ],
};

export const BUILT_INS: ProfileEntry[] = [
  { profile: STEPS, builtIn: true },
  { profile: CURVE, builtIn: true },
];
