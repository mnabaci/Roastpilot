import { describe, expect, it } from 'vitest';
import {
  AutoProfileSchema,
  AutoTuningSchema,
  CURVE_FOLLOW_DEFAULTS,
  PROFILE_SCHEMA_VERSION,
  type AutoProfile,
} from './profile';

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
      heat: { mode: 'target', pct: 85, endC: 150, durationS: 245, rorMin: 14, rorMax: 18 },
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
    const flipped = {
      ...second,
      heat: { mode: 'target', pct: 85, endC: 150, durationS: 245, rorMin: 18, rorMax: 14 },
    };
    const phases = [first, flipped, last];
    expect(AutoProfileSchema.safeParse({ ...profile, phases }).success).toBe(false);
  });

  it("refuses a target step ending somewhere other than the next phase's trigger", () => {
    const [first, second, last] = profile.phases;
    const moved = { ...second, next: { on: 'bt', c: 160, backupS: 390 } };
    expect(AutoProfileSchema.safeParse({ ...profile, phases: [first, moved, last] }).success).toBe(
      false,
    );
  });

  it.each([
    ['chargeC', { chargeC: 90 }],
    ['chargeC', { chargeC: 240 }],
    ['capC', { capC: 236 }],
    ['capC', { chargeC: 205, capC: 205 }],
    ['devTimeS', { devTimeS: 10 }],
    ['devTimeS', { devTimeS: 601 }],
    ['dryEndC', { dryEndC: 200 }],
  ])('refuses %s outside its limits, naming the field', (field, change) => {
    const parsed = AutoProfileSchema.safeParse({ ...profile, ...change });
    expect(parsed.error?.issues.map((i) => i.path[0])).toContain(field);
  });

  it('refuses a temperature trigger at or above the BT cap, or below the step before', () => {
    const [soak, ...rest] = profile.phases;
    const step = (c: number, backupS: number) =>
      ({
        name: 'Step',
        heat: { mode: 'follow', pct: 50 },
        fanPct: 30,
        next: { on: 'bt', c, backupS },
      }) as const;
    const withSteps = (steps: AutoProfile['phases']) => ({
      ...profile,
      phases: [...(soak ? [soak] : []), ...steps, ...rest.slice(-1)],
    });
    expect(AutoProfileSchema.safeParse(withSteps([step(150, 100), step(170, 200)])).success).toBe(
      true,
    );
    for (const steps of [
      [step(150, 100), step(140, 200)],
      [step(150, 200), step(170, 100)],
      [step(profile.capC, 100)],
    ]) {
      expect(AutoProfileSchema.safeParse(withSteps(steps)).success).toBe(false);
    }
  });

  it('refuses a step longer than 15 min, a backup after 19 min and a curve above the cap', () => {
    const [soak, heatOn, finish] = profile.phases;
    if (soak?.heat.mode !== 'fixed' || heatOn?.heat.mode !== 'target' || !finish) {
      throw new Error('fixture changed');
    }
    const issues = (change: Partial<AutoProfile>) =>
      AutoProfileSchema.safeParse({ ...profile, ...change }).error?.issues.map((i) => i.path);
    const longStep = { ...heatOn, heat: { ...heatOn.heat, durationS: 901 } };
    expect(issues({ phases: [soak, longStep, finish] })).toEqual([
      ['phases', 1, 'heat', 'durationS'],
    ]);
    const lateBackup = { ...heatOn, next: { on: 'bt', c: 150, backupS: 1141 } } as const;
    expect(issues({ phases: [soak, lateBackup, finish] })).toEqual([
      ['phases', 1, 'next', 'backupS'],
    ]);
    const curve = [...profile.curve, { tS: 600, c: profile.capC + 1 }];
    expect(issues({ curve })).toEqual([['curve', 2, 'c']]);
  });

  it('refuses a saved format from a different version', () => {
    expect(AutoProfileSchema.safeParse({ ...profile, schemaVersion: 99 }).success).toBe(false);
  });
});

describe('AutoTuningSchema', () => {
  /** As the first roaster migration saved it, before curve phases followed RoR. */
  const saved = {
    target: { kp: 1.5, ki: 0.02, kd: 0 },
    targetLimitPct: 20,
    follow: { kp: 1, ki: 0.01, kd: 0 },
    preheat: { kp: 5, ki: 0.02, kd: 0 },
    preheatFanPct: 30,
    holdS: 150,
    chargeCutS: 5,
  };

  it('reads a record saved before curve following, with its defaults', () => {
    const parsed = AutoTuningSchema.parse(saved);
    expect(parsed.curveFollow).toEqual(CURVE_FOLLOW_DEFAULTS);
    expect(parsed).not.toHaveProperty('follow');
  });

  it('keeps curve following as saved', () => {
    const curveFollow = { ...CURVE_FOLLOW_DEFAULTS, lookAheadS: 45 };
    expect(AutoTuningSchema.parse({ ...saved, curveFollow }).curveFollow.lookAheadS).toBe(45);
  });

  it('refuses a slew limit of 0, which would freeze the heater', () => {
    const curveFollow = { ...CURVE_FOLLOW_DEFAULTS, slewPctPer10s: 0 };
    expect(AutoTuningSchema.safeParse({ ...saved, curveFollow }).success).toBe(false);
  });
});
