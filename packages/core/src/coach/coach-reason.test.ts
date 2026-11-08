import { describe, expect, it } from 'vitest';
import { curveReason, phaseReason, STALLING, stepReason } from './coach-reason';

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

  it('says so when RoR stalls', () => {
    expect(STALLING).toBe('RoR stalling');
  });
});
