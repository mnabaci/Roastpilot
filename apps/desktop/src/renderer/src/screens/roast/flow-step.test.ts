import { READY_ROAST, type RoastState } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { flowHint, flowStep } from './flow-step';

const COOLING: RoastState = { ...READY_ROAST, phase: 'cooling' };

describe('flowStep', () => {
  it('offers +1 min while the beans cool, and Finish cooling now ends only their countdown', () => {
    expect(flowStep(COOLING).quiet).toEqual({ action: 'extend-cooling', label: '+1 min' });
    expect(flowStep(COOLING).stop).toEqual({
      label: 'Finish cooling now',
      question: 'Finish cooling the beans? · the countdown ends now',
    });
  });
});

describe('flowHint', () => {
  it('counts down while the beans cool', () => {
    expect(flowHint(COOLING, { coolingLeftS: 95 })).toBe(
      'Dump the beans into the cooling tray. 1:35 left.',
    );
  });

  it('says how much earlier the charge point was found', () => {
    const roast: RoastState = {
      ...READY_ROAST,
      phase: 'roasting',
      chargedAtMs: 1000,
      startPressedAtMs: 8000,
    };
    expect(flowHint(roast, { coolingLeftS: undefined })).toBe(
      'Charge found 0:07 before you pressed · press at first crack.',
    );
  });
});
