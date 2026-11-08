import { sayInUnit } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import {
  curveReason as curveTokens,
  phaseReason as phaseTokens,
  STALLING,
  stepReason as stepTokens,
} from './coach-reason';

// What the card says in °C.
const curveReason = (...args: Parameters<typeof curveTokens>) =>
  sayInUnit(curveTokens(...args), 'c');
const stepReason = (...args: Parameters<typeof stepTokens>) => sayInUnit(stepTokens(...args), 'c');
const phaseReason = (...args: Parameters<typeof phaseTokens>) =>
  sayInUnit(phaseTokens(...args), 'c');

describe('coach reasons', () => {
  it('says how far BT is from the curve, and where RoR is heading', () => {
    expect(curveReason(-4.2, 'falling')).toBe('4 °C below target, RoR falling');
    expect(curveReason(3.6, 'rising')).toBe('4 °C above target, RoR rising');
    expect(curveReason(0.4, 'steady')).toBe('On target, RoR steady');
    expect(curveReason(-2, undefined)).toBe('2 °C below target');
  });

  it("puts a step's RoR against its range", () => {
    expect(stepReason(6.54, 8, 12)).toBe('RoR 6.5 · step wants 8–12');
    expect(stepReason(-0.02, 3.5, 7)).toBe('RoR 0.0 · step wants 3.5–7');
    expect(stepReason(undefined, 14, 18)).toBe('Step wants RoR 14–18');
  });

  it('names a phase and where it began', () => {
    expect(phaseReason('Maillard', 150.4)).toBe('Maillard from 150 °C');
    expect(phaseReason('Soak', undefined)).toBe('Soak');
  });

  it('says it all in °F, a gap and a RoR without + 32', () => {
    expect(sayInUnit(curveTokens(-4, 'falling'), 'f')).toBe('7.2 °F below target, RoR falling');
    expect(sayInUnit(stepTokens(6.54, 8, 12), 'f')).toBe('RoR 11.7 · step wants 14.4–21.6');
    expect(sayInUnit(phaseTokens('Maillard', 150), 'f')).toBe('Maillard from 302 °F');
  });

  it('says so when RoR stalls', () => {
    expect(STALLING).toBe('RoR stalling');
  });
});
