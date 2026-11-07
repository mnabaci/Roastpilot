import type { AutoProfile } from '@roastpilot/shared';
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
    expect(planLine(PLAN, 300, 146.4)).toBe('−4 °C vs plan');
    expect(planLine(PLAN, 300, 153.2)).toBe('+3 °C vs plan');
    expect(planLine(PLAN, 300, 150.3)).toBe('On plan');
  });

  it('says nothing before the turning point', () => {
    expect(planLine(PLAN, 30, 120)).toBeUndefined();
  });
});

const PROFILE = {
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

describe('rorAimLine', () => {
  it("gives a step's RoR range", () => {
    expect(rorAimLine(PROFILE, 'Maillard', false)).toBe('Aim 8–10');
  });

  it('aims for at least 5 until your first-crack tap', () => {
    expect(rorAimLine(PROFILE, 'Development', false)).toBe('Aim 5–7');
    expect(rorAimLine(PROFILE, 'Development', true)).toBe('Aim 3–7');
  });

  it('has nothing for a fixed or curve phase, or none running', () => {
    expect(rorAimLine(PROFILE, 'Soak', false)).toBeUndefined();
    expect(rorAimLine(PROFILE, 'Follow', false)).toBeUndefined();
    expect(rorAimLine(PROFILE, null, false)).toBeUndefined();
  });
});
