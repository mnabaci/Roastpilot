import { CURVE_FOLLOW_DEFAULTS, type AutoProfile } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { planLine, rorAimLine } from './plan-lines';

const PLAN = [
  { tS: 0, c: 180 },
  { tS: 60, c: 92 },
  { tS: 300, c: 150 },
  { tS: 600, c: 190 },
];

describe('planLine', () => {
  it('says how far BT is from the plan, rounded', () => {
    expect(planLine(PLAN, 300, 146.4, 'c')).toBe('−4 °C vs plan');
    expect(planLine(PLAN, 300, 153.2, 'c')).toBe('+3 °C vs plan');
    expect(planLine(PLAN, 300, 150.3, 'c')).toBe('On plan');
  });

  it('says it in °F as a difference, never + 32', () => {
    expect(planLine(PLAN, 300, 146, 'f')).toBe('−7 °F vs plan');
    expect(planLine(PLAN, 300, 150.2, 'f')).toBe('On plan');
  });

  it('says nothing before the turning point', () => {
    expect(planLine(PLAN, 30, 120, 'c')).toBeUndefined();
  });
});

const PROFILE = {
  curve: PLAN,
  phases: [
    { name: 'Soak', heat: { mode: 'fixed', pct: 0 } },
    {
      name: 'Maillard',
      heat: { mode: 'target', pct: 50, endC: 180, durationS: 98, rorMin: 8, rorMax: 10 },
    },
    {
      name: 'Development',
      heat: { mode: 'target', pct: 40, endC: 191, durationS: 94, rorMin: 3, rorMax: 7 },
    },
    { name: 'Follow', heat: { mode: 'follow', pct: 50 } },
  ],
} as unknown as AutoProfile;

const aim = (phaseName: string | null, firstCracked = false) => ({
  phaseName,
  firstCracked,
  unit: 'c' as const,
});

describe('rorAimLine', () => {
  it("gives a step's RoR range", () => {
    expect(rorAimLine(PROFILE, aim('Maillard'))).toBe('Aim 8–10');
  });

  it('gives it in °F/min, × 1.8 with no + 32', () => {
    expect(rorAimLine(PROFILE, { ...aim('Maillard'), unit: 'f' })).toBe('Aim 14.4–18');
    const onPlan = {
      ...aim('Follow'),
      unit: 'f' as const,
      elapsedS: 300,
      btC: 150,
      curveFollow: CURVE_FOLLOW_DEFAULTS,
    };
    // 9.5 °C/min is 17.1 °F/min.
    expect(rorAimLine(PROFILE, onPlan)).toBe('Aim 17');
  });

  it('aims for at least 5 until your first-crack tap', () => {
    expect(rorAimLine(PROFILE, aim('Development'))).toBe('Aim 5–7');
    expect(rorAimLine(PROFILE, aim('Development', true))).toBe('Aim 3–7');
  });

  it("gives a curve phase's aim now, as Auto works it out", () => {
    // 5:00, on the plan at 150 °C: 30 s on, the smooth plan climbs 9.5 °C/min.
    const onPlan = {
      ...aim('Follow'),
      elapsedS: 300,
      btC: 150,
      curveFollow: CURVE_FOLLOW_DEFAULTS,
    };
    expect(rorAimLine(PROFILE, onPlan)).toBe('Aim 10');
    // 10 °C behind: 3 °C/min more.
    expect(rorAimLine(PROFILE, { ...onPlan, btC: 140 })).toBe('Aim 13');
  });

  it('has no curve aim without the temperature or the tuning', () => {
    expect(rorAimLine(PROFILE, { ...aim('Follow'), elapsedS: 300, btC: 150 })).toBeUndefined();
    const noBt = { ...aim('Follow'), elapsedS: 300, curveFollow: CURVE_FOLLOW_DEFAULTS };
    expect(rorAimLine(PROFILE, noBt)).toBeUndefined();
  });

  it('has nothing for a fixed phase, or none running', () => {
    expect(rorAimLine(PROFILE, aim('Soak'))).toBeUndefined();
    expect(rorAimLine(PROFILE, aim(null))).toBeUndefined();
  });
});
