import { READY_ROAST, type RoastState } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { flowHint, flowStep } from './flow-step';

const cooling = (coolingBelowC: number | null): RoastState => ({
  ...READY_ROAST,
  phase: 'cooling',
  coolingBelowC,
});

describe('flowStep', () => {
  it('offers +1 min while cooling by time', () => {
    expect(flowStep(cooling(null)).quiet?.label).toBe('+1 min');
  });

  it('has no +1 min while cooling by temperature', () => {
    expect(flowStep(cooling(90)).quiet).toBeUndefined();
    expect(flowStep(cooling(90)).stop?.label).toBe('Finish cooling now');
  });
});

describe('flowHint', () => {
  it('counts down while cooling by time', () => {
    expect(flowHint(cooling(null), { coolingLeftS: 95, temp: 140 })).toBe(
      'Dump the beans into the cooling tray. 1:35 left.',
    );
  });

  it('shows the temperature against its target while cooling by temperature', () => {
    expect(flowHint(cooling(90), { coolingLeftS: 500, temp: 112.4 })).toBe(
      'Dump the beans into the cooling tray. 112 °C → 90 °C.',
    );
    expect(flowHint(cooling(90), { coolingLeftS: 500, temp: undefined })).toContain('– °C → 90 °C');
  });

  it('says how much earlier the charge point was found', () => {
    const roast: RoastState = {
      ...READY_ROAST,
      phase: 'roasting',
      chargedAtMs: 1000,
      startPressedAtMs: 8000,
    };
    expect(flowHint(roast, { coolingLeftS: undefined, temp: 90 })).toBe(
      'Charge found 0:07 before you pressed · press at first crack.',
    );
  });
});
