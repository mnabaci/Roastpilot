import { PROFILE_SCHEMA_VERSION, type AutoProfile, type Milestones } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { milestonesFrom, profileFromMilestones } from './profile-from-milestones';

const follow = (name: string, fanPct: number, next: AutoProfile['phases'][number]['next']) => ({
  name,
  heat: { mode: 'follow' as const, pct: 60 },
  fanPct,
  next,
});

/** Shaped like the Skywalker's Light · Curve. */
const BASE: AutoProfile = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  id: 'light-curve',
  name: 'Light · Curve',
  needsCalibration: true,
  batchG: 385,
  chargeC: 180,
  dryEndC: 150,
  devTimeS: 90,
  capC: 200,
  curve: [
    { tS: 0, c: 180 },
    { tS: 64, c: 92 },
    { tS: 154, c: 110 },
    { tS: 305, c: 150 },
    { tS: 558, c: 190 },
    { tS: 663, c: 197 },
  ],
  phases: [
    { name: 'Soak', heat: { mode: 'fixed', pct: 0 }, fanPct: 30, next: { on: 'time', afterS: 60 } },
    follow('Heat on', 30, { on: 'bt', c: 150, backupS: 390 }),
    follow('Yellowing', 50, { on: 'bt', c: 165, backupS: 480 }),
    follow('Maillard', 65, { on: 'bt', c: 180, backupS: 660 }),
    follow('Development', 80, { on: 'end' }),
  ],
};

const make = (milestones: Milestones) =>
  profileFromMilestones({ milestones, base: BASE, id: 'custom-1', name: 'Milestones' });

describe('milestonesFrom', () => {
  it('reads the milestones off a curve profile, to start from', () => {
    expect(milestonesFrom(BASE)).toEqual({
      chargeC: 180,
      turningPoint: { tS: 64, c: 92 },
      dryEnd: { tS: 305, c: 150 },
      firstCrack: { tS: 573, c: 191 },
      drop: { tS: 663, c: 197 },
      extras: [],
    });
  });
});

describe('profileFromMilestones', () => {
  const light = milestonesFrom(BASE);

  it('sets charge, dry end, development time and cap from the milestones', () => {
    const drop = { tS: 630, c: 205 };
    expect(make({ ...light, chargeC: 190, drop })).toMatchObject({
      id: 'custom-1',
      name: 'Milestones',
      chargeC: 190,
      dryEndC: 150,
      devTimeS: 57,
      capC: 208,
      batchG: 385,
      needsCalibration: true,
    });
  });

  it('draws the curve through every milestone and your points, every 30 s', () => {
    const extras = [{ tS: 154, c: 110 }];
    const curve = make({ ...light, extras }).curve;
    for (const p of [{ tS: 0, c: 180 }, light.turningPoint, ...extras, light.drop]) {
      expect(curve).toContainEqual(p);
    }
    expect(curve.filter((p) => p.tS % 30 === 0)).toHaveLength(23);
  });

  it('keeps the soak, fan steps and heat, with each backup a minute after the curve gets there', () => {
    const { phases } = make(light);
    expect(phases.map((p) => [p.name, p.fanPct])).toEqual([
      ['Soak', 30],
      ['Heat on', 30],
      ['Yellowing', 50],
      ['Maillard', 65],
      ['Development', 80],
    ]);
    expect(phases[1]?.next).toEqual({ on: 'bt', c: 150, backupS: 365 });
    expect(phases[2]?.next).toMatchObject({ on: 'bt', c: 165 });
    expect(phases.at(-1)?.next).toEqual({ on: 'end' });
  });

  it('drops a phase that would start at or above the cap; the one before runs to the end', () => {
    const low = {
      ...light,
      firstCrack: { tS: 520, c: 170 },
      drop: { tS: 600, c: 176 },
    };
    const profile = make(low);
    expect(profile.capC).toBe(179);
    expect(profile.phases.map((p) => p.name)).toEqual(['Soak', 'Heat on', 'Yellowing', 'Maillard']);
    expect(profile.phases.at(-1)?.next).toEqual({ on: 'end' });
  });

  it('is a new profile of your own, with no source', () => {
    expect(make(light).source).toBeUndefined();
  });
});
