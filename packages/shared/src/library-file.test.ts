import { describe, expect, it } from 'vitest';
import {
  ExportLibraryRequestSchema,
  FileBeanSchema,
  FileProfileSchema,
  FileRoasterSchema,
} from './library-file';
import { overRoasterLimits } from './profile-rules';

const PROFILE = {
  schemaVersion: 1,
  name: 'Mine',
  needsCalibration: false,
  batchG: 385,
  chargeC: 180,
  dryEndC: 150,
  devTimeS: 90,
  capC: 210,
  curve: [
    { tS: 0, c: 180 },
    { tS: 600, c: 205 },
  ],
  phases: [
    { name: 'Soak', heat: { mode: 'fixed', pct: 0 }, fanPct: 30, next: { on: 'time', afterS: 60 } },
    { name: 'Heat', heat: { mode: 'follow', pct: 80 }, fanPct: 50, next: { on: 'end' } },
  ],
} as const;

describe('library file items', () => {
  it('a profile leaves its id and source behind, and keeps the rules of Save', () => {
    const parsed = FileProfileSchema.parse({
      ...PROFILE,
      id: 'custom-1',
      source: { kind: 'roast', roastId: 3 },
    });
    expect(parsed).not.toHaveProperty('id');
    expect(parsed).not.toHaveProperty('source');
    expect(FileProfileSchema.safeParse({ ...PROFILE, capC: 170 }).success).toBe(false);
  });

  it('a roaster leaves its id, port and active flag behind, and keeps its model limits', () => {
    const record = {
      name: 'Kitchen',
      model: 'skywalker',
      batchMinG: 250,
      batchIdealG: 385,
      batchMaxG: 450,
      maxTempC: 240,
      maxTimeS: 1200,
      tempOffsetC: 0,
      tuning: {
        target: { kp: 1, ki: 0, kd: 0 },
        targetLimitPct: 20,
        preheat: { kp: 1, ki: 0, kd: 0 },
        preheatFanPct: 30,
        holdS: 60,
        chargeCutS: 10,
      },
      coolerHelpsDrum: true,
      drumSpeedPct: 60,
    };
    const parsed = FileRoasterSchema.parse({
      ...record,
      id: 4,
      connection: { kind: 'serial', path: 'COM3' },
      active: true,
    });
    expect(Object.keys(parsed)).not.toContain('connection');
    expect(Object.keys(parsed)).not.toContain('active');
    expect(FileRoasterSchema.safeParse({ ...record, batchMinG: 500 }).success).toBe(false);
  });

  it('a bean carries its profile by name, or none', () => {
    const bean = {
      name: 'Guji',
      origin: 'Ethiopia',
      process: 'washed',
      variety: null,
      altitudeM: null,
      densityGL: null,
      moisturePct: null,
      screen: null,
      decaf: false,
      supplier: null,
      lowStockG: 500,
      notes: null,
    };
    expect(FileBeanSchema.safeParse({ ...bean, profileName: null }).success).toBe(true);
    expect(FileBeanSchema.safeParse({ ...bean, profileName: '' }).success).toBe(false);
  });

  it('an export names ids of the kind, or none for all', () => {
    expect(ExportLibraryRequestSchema.safeParse({ kind: 'profiles', ids: ['a'] }).success).toBe(
      true,
    );
    expect(ExportLibraryRequestSchema.safeParse({ kind: 'beans', ids: ['a'] }).success).toBe(false);
    expect(ExportLibraryRequestSchema.safeParse({ kind: 'roasters' }).success).toBe(true);
  });
});

describe("a profile on this roaster's limits", () => {
  const limits = { maxTempC: 240, maxTimeS: 1200 };

  it('fits when its cap and its time are inside them', () => {
    expect(overRoasterLimits(PROFILE, limits)).toBeUndefined();
  });

  it('refuses a cap above the max temperature', () => {
    expect(overRoasterLimits(PROFILE, { ...limits, maxTempC: 200 })).toBe(
      "BT cap 210 °C is above this roaster's 200 °C",
    );
  });

  it('refuses a curve, or a backup, past the max time', () => {
    expect(overRoasterLimits(PROFILE, { ...limits, maxTimeS: 540 })).toBe(
      "Runs past this roaster's 9 min limit",
    );
    const backup = {
      ...PROFILE,
      phases: [
        {
          name: 'Dry',
          heat: { mode: 'fixed', pct: 50 },
          fanPct: 30,
          next: { on: 'bt', c: 150, backupS: 900 },
        },
        PROFILE.phases[1],
      ],
    } as const;
    expect(overRoasterLimits(backup, { ...limits, maxTimeS: 840 })).toBe(
      "Runs past this roaster's 14 min limit",
    );
  });
});
