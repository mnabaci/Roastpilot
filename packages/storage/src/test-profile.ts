import { PROFILE_SCHEMA_VERSION, type AutoProfile } from '@roastpilot/shared';

/** A small valid profile for the repository tests. */
export const TEST_PROFILE: AutoProfile = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  id: 'custom-1',
  name: 'Mine',
  needsCalibration: true,
  batchG: 385,
  chargeC: 180,
  dryEndC: 150,
  devTimeS: 90,
  capC: 200,
  curve: [
    { tS: 0, c: 180 },
    { tS: 600, c: 197 },
  ],
  phases: [
    { name: 'Soak', heat: { mode: 'fixed', pct: 0 }, fanPct: 30, next: { on: 'time', afterS: 60 } },
    { name: 'Heat', heat: { mode: 'follow', pct: 80 }, fanPct: 50, next: { on: 'end' } },
  ],
};
