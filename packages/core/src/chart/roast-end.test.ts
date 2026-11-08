import { PROFILE_SCHEMA_VERSION, type AutoProfile } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ROAST_END_S, expectedRoastEndS, plannedDropS } from './roast-end';

/** The built-in Light · Curve: roast 7, charge 180 °C, dropped at 11:03. */
const CURVE_PROFILE: AutoProfile = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  id: 'light-curve',
  name: 'Light · Curve',
  needsCalibration: true,
  batchG: 385,
  chargeC: 180,
  dryEndC: 150,
  devTimeS: 105,
  capC: 200,
  curve: [
    { tS: 0, c: 180 },
    { tS: 64, c: 92 },
    { tS: 305, c: 150 },
    { tS: 558, c: 190 },
    { tS: 663, c: 197 },
  ],
  phases: [{ name: 'Roast', heat: { mode: 'follow', pct: 60 }, fanPct: 50, next: { on: 'end' } }],
};

describe('expectedRoastEndS', () => {
  it("is the profile's planned drop when there is one", () => {
    expect(expectedRoastEndS({ plannedDropS: 676, ghostDropS: 640 })).toBe(676);
  });

  it("is the ghost's drop without a profile", () => {
    expect(expectedRoastEndS({ plannedDropS: undefined, ghostDropS: 640 })).toBe(640);
  });

  it('is 12:00 with neither', () => {
    expect(expectedRoastEndS({ plannedDropS: undefined, ghostDropS: undefined })).toBe(720);
    expect(DEFAULT_ROAST_END_S).toBe(12 * 60);
  });
});

describe('plannedDropS', () => {
  it("is a curve profile's last point", () => {
    expect(plannedDropS(CURVE_PROFILE)).toBe(663);
  });

  it("is a step profile's steps plus its development time", () => {
    const steps: AutoProfile = {
      ...CURVE_PROFILE,
      phases: [
        {
          name: 'Soak',
          heat: { mode: 'fixed', pct: 0 },
          fanPct: 30,
          next: { on: 'time', afterS: 60 },
        },
        {
          name: 'Heat on',
          heat: { mode: 'target', pct: 85, endC: 150, durationS: 245, rorMin: 14, rorMax: 18 },
          fanPct: 30,
          next: { on: 'end' },
        },
      ],
    };
    // 1:00 soak, 4:05 to 150 °C, then 1:45 of development.
    expect(plannedDropS(steps)).toBe(60 + 245 + 105);
  });
});
