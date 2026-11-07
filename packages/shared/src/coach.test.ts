import { describe, expect, it } from 'vitest';
import {
  CoachAdviceSchema,
  CoachApplyErrorSchema,
  CoachRequestSchema,
  CoachStatusSchema,
  COACH_QUIET,
  coachAppliedDetail,
} from './coach';

describe('coach contract', () => {
  it('carries one or both outputs on a setting suggestion', () => {
    const both = {
      kind: 'setting',
      id: 3,
      heater: { from: 65, to: 75 },
      fan: { from: 50, to: 40 },
      reason: '4 °C below target, RoR falling',
    };
    expect(CoachAdviceSchema.parse(both)).toEqual(both);
    const fanOnly = { kind: 'setting', id: 4, fan: { from: 50, to: 40 }, reason: 'Maillard' };
    expect(CoachAdviceSchema.parse(fanOnly)).toEqual(fanOnly);
  });

  it('carries the numbers of each heads-up', () => {
    expect(CoachAdviceSchema.safeParse({ kind: 'first-crack-soon', id: 1, inS: 45 }).success).toBe(
      true,
    );
    expect(
      CoachAdviceSchema.safeParse({ kind: 'drop-soon', id: 1, inS: 30, devTimeS: 105 }).success,
    ).toBe(true);
    expect(
      CoachAdviceSchema.safeParse({ kind: 'cap-soon', id: 1, inS: 30, capC: 225 }).success,
    ).toBe(true);
    expect(CoachAdviceSchema.safeParse({ kind: 'cap-soon', id: 1, inS: 30 }).success).toBe(false);
  });

  it('starts quiet', () => {
    expect(CoachStatusSchema.parse(COACH_QUIET)).toEqual({ advice: null, needsCalibration: null });
  });

  it('asks for a whole-number id on Apply and Dismiss', () => {
    expect(CoachRequestSchema.safeParse({ id: 2 }).success).toBe(true);
    expect(CoachRequestSchema.safeParse({ id: 2.5 }).success).toBe(false);
    expect(CoachRequestSchema.safeParse({}).success).toBe(false);
  });

  it('refuses Apply as stale, not now, or as the roaster did', () => {
    for (const error of [
      { kind: 'stale' },
      { kind: 'not-now' },
      { kind: 'safety-locked', channel: 'heater' },
    ])
      expect(CoachApplyErrorSchema.safeParse(error).success).toBe(true);
  });

  it('writes each output changed, heater first', () => {
    expect(coachAppliedDetail({ fan: { from: 50, to: 40 }, heater: { from: 65, to: 75 } })).toBe(
      'heater 65→75, fan 50→40',
    );
    expect(coachAppliedDetail({ fan: { from: 50, to: 40 } })).toBe('fan 50→40');
  });
});
