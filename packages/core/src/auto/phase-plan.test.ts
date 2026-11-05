import { PROFILE_SCHEMA_VERSION, type AutoProfile } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { developmentTimeRule, btCapRule, dueEndRule } from './end-rules';
import { advancePhase, dryEndReached, withSoakTime } from './phase-plan';

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
    {
      name: 'Development',
      heat: { mode: 'target', pct: 40, endC: 191, durationS: 94, rorMin: 3, rorMax: 7 },
      fanPct: 80,
      next: { on: 'end' },
    },
  ],
};

describe('advancePhase', () => {
  it('stays in the soak until its time', () => {
    expect(advancePhase(PROFILE, 0, { elapsedS: 59, btC: 92 })).toBe(0);
    expect(advancePhase(PROFILE, 0, { elapsedS: 60, btC: 92 })).toBe(1);
  });

  it('moves on when BT reaches the trigger', () => {
    expect(advancePhase(PROFILE, 1, { elapsedS: 200, btC: 149.9 })).toBe(1);
    expect(advancePhase(PROFILE, 1, { elapsedS: 200, btC: 150 })).toBe(2);
  });

  it('moves on at the backup time if BT never gets there', () => {
    expect(advancePhase(PROFILE, 1, { elapsedS: 390, btC: 120 })).toBe(2);
  });

  it('uses the backup time when there is no reading', () => {
    expect(advancePhase(PROFILE, 1, { elapsedS: 200, btC: undefined })).toBe(1);
    expect(advancePhase(PROFILE, 1, { elapsedS: 390, btC: undefined })).toBe(2);
  });

  it('moves one phase per call, so no phase is skipped', () => {
    expect(advancePhase(PROFILE, 0, { elapsedS: 500, btC: 190 })).toBe(1);
  });

  it('stays in the last phase: only the end rule ends it', () => {
    expect(advancePhase(PROFILE, 2, { elapsedS: 5000, btC: 500 })).toBe(2);
  });

  it('never moves for a phase that does not exist', () => {
    expect(advancePhase(PROFILE, 9, { elapsedS: 500, btC: 190 })).toBe(9);
  });
});

describe('withSoakTime', () => {
  it('changes only the opening soak', () => {
    const changed = withSoakTime(PROFILE, 90);
    expect(changed.phases[0]?.next).toEqual({ on: 'time', afterS: 90 });
    expect(changed.phases.slice(1)).toEqual(PROFILE.phases.slice(1));
  });

  it('leaves the original alone', () => {
    withSoakTime(PROFILE, 90);
    expect(PROFILE.phases[0]?.next).toEqual({ on: 'time', afterS: 60 });
  });

  it('leaves a profile that opens without a timed fixed phase', () => {
    const phases = PROFILE.phases.slice(1);
    expect(withSoakTime({ ...PROFILE, phases }, 90).phases).toEqual(phases);
  });
});

describe('dryEndReached', () => {
  it('ignores the temperature falling through it after charge', () => {
    expect(dryEndReached(PROFILE, 0, 170)).toBe(false);
  });

  it('counts once the soak is over and BT has climbed to it', () => {
    expect(dryEndReached(PROFILE, 1, 149)).toBe(false);
    expect(dryEndReached(PROFILE, 1, 150)).toBe(true);
  });

  it('needs a reading', () => {
    expect(dryEndReached(PROFILE, 1, undefined)).toBe(false);
  });
});

describe('end rules', () => {
  const INPUT = { profile: PROFILE, sinceFirstCrackS: undefined, btC: 190 };

  it('keeps roasting with no tap and BT under the cap', () => {
    expect(dueEndRule(INPUT)).toBeUndefined();
  });

  it('drops at the development time after your tap', () => {
    expect(dueEndRule({ ...INPUT, sinceFirstCrackS: 89 })).toBeUndefined();
    expect(dueEndRule({ ...INPUT, sinceFirstCrackS: 90 })).toBe(developmentTimeRule);
  });

  it('drops at the BT cap with no tap', () => {
    expect(dueEndRule({ ...INPUT, btC: 199.9 })).toBeUndefined();
    expect(dueEndRule({ ...INPUT, btC: 200 })).toBe(btCapRule);
  });

  it('does not take a lost reading for the cap', () => {
    expect(dueEndRule({ ...INPUT, btC: undefined })).toBeUndefined();
  });
});
