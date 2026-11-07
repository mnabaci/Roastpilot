import { describe, expect, it } from 'vitest';
import { COACH_PROFILE, coachInputOf } from './coach.harness';
import { autoSettingRule, PHASE_NEWS_S, settingReason } from './setting-rule';

const [soak, drying, maillard] = COACH_PROFILE.phases;
const step = (change: Partial<ReturnType<typeof coachInputOf>['step']>) => ({
  ...coachInputOf().step,
  ...change,
});

describe('autoSettingRule', () => {
  it('says nothing while Auto is within 10 points of what is set', () => {
    expect(
      autoSettingRule.advise(coachInputOf({ wants: { heater: 89, fan: 39 } })),
    ).toBeUndefined();
  });

  it('suggests an output 10 points or more away, from what is set to what Auto wants', () => {
    expect(autoSettingRule.advise(coachInputOf({ wants: { heater: 90, fan: 30 } }))).toEqual({
      kind: 'setting',
      heater: { from: 80, to: 90 },
      reason: 'RoR 10.0 · step wants 8–12',
    });
    expect(autoSettingRule.advise(coachInputOf({ wants: { heater: 80, fan: 15 } }))).toMatchObject({
      fan: { from: 30, to: 15 },
    });
  });

  it('carries both outputs on one card', () => {
    expect(autoSettingRule.advise(coachInputOf({ wants: { heater: 65, fan: 50 } }))).toMatchObject({
      heater: { from: 80, to: 65 },
      fan: { from: 30, to: 50 },
    });
  });

  it('says nothing in the soak, however far Auto is from what is set', () => {
    const input = coachInputOf({
      step: step({ index: 0, phase: soak, soak: true }),
      set: { heater: 70, fan: 0 },
      wants: { heater: 0, fan: 30 },
    });
    expect(autoSettingRule.advise(input)).toBeUndefined();
  });

  it('leaves out an output the roaster has not reported', () => {
    const input = coachInputOf({
      set: { heater: undefined, fan: 30 },
      wants: { heater: 0, fan: 30 },
    });
    expect(autoSettingRule.advise(input)).toBeUndefined();
  });
});

describe('settingReason', () => {
  it('on a step, puts RoR against the step range', () => {
    expect(settingReason(coachInputOf({ ror: 6.54 }))).toBe('RoR 6.5 · step wants 8–12');
  });

  it('on a curve, says how far BT is from the curve and where RoR is heading', () => {
    // The curve is at 150 °C at 300 s.
    const input = coachInputOf({
      elapsedS: 300,
      btC: 146,
      trend: 'falling',
      step: step({ index: 2, phase: maillard, newForS: PHASE_NEWS_S }),
    });
    expect(settingReason(input)).toBe('4 °C below target, RoR falling');
  });

  it('names a phase that has just begun, and where it began', () => {
    const input = coachInputOf({
      step: step({ index: 2, phase: maillard, startC: 150.2, newForS: PHASE_NEWS_S - 1 }),
    });
    expect(settingReason(input)).toBe('Maillard from 150 °C');
  });

  it('names a fixed phase, with or without where it began', () => {
    expect(
      settingReason(coachInputOf({ step: step({ index: 0, phase: soak, startC: 180 }) })),
    ).toBe('Soak from 180 °C');
    expect(
      settingReason(coachInputOf({ step: step({ index: 0, phase: soak, startC: undefined }) })),
    ).toBe('Soak');
  });

  it('says RoR is stalling once the stall guard trips, whatever the phase', () => {
    expect(settingReason(coachInputOf({ step: step({ phase: drying, stallTripped: true }) }))).toBe(
      'RoR stalling',
    );
  });

  it('falls back on the phase name on a curve without a reading', () => {
    const input = coachInputOf({
      btC: undefined,
      step: step({ index: 2, phase: maillard, startC: undefined, newForS: undefined }),
    });
    expect(settingReason(input)).toBe('Maillard');
  });
});
