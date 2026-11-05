import { AUTO_OFF, READY_ROAST, type AutoProfile, type AutoStatus } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { autoFlowStep } from './auto-flow';

const PROFILE = { chargeC: 180, devTimeS: 90, capC: 200 } as AutoProfile;
const ON: AutoStatus = { ...AUTO_OFF, enabled: true };
const PREHEAT = { ...READY_ROAST, phase: 'preheat' } as const;
const ROASTING = { ...READY_ROAST, phase: 'roasting' } as const;
const DEVELOPMENT = { ...READY_ROAST, phase: 'development' } as const;

describe('autoFlowStep', () => {
  it('leaves the normal flow alone when Auto is off or stopped, or nothing is driven', () => {
    expect(autoFlowStep(ROASTING, AUTO_OFF, PROFILE)).toBeUndefined();
    expect(autoFlowStep(ROASTING, { ...ON, stopped: true }, PROFILE)).toBeUndefined();
    expect(autoFlowStep({ ...READY_ROAST, phase: 'cooling' }, ON, PROFILE)).toBeUndefined();
    expect(autoFlowStep(ROASTING, ON, undefined)).toBeUndefined();
  });

  it('before Preheat says Auto does the warming up', () => {
    expect(autoFlowStep(READY_ROAST, ON, PROFILE)).toMatchObject({
      primary: { action: 'preheat' },
      hint: 'Auto heats to 180 °C and holds · then add beans.',
    });
  });

  it.each([
    ['cool', null, 'Too hot · cooling before the climb to 180 °C.'],
    ['climb', null, 'Heating to 180 °C.'],
    ['hold', 90, 'Holding 180 °C · 1:30 left.'],
  ] as const)('in %s keeps Start as the second button', (preheatStep, preheatLeftS, hint) => {
    const step = autoFlowStep(PREHEAT, { ...ON, preheatStep, preheatLeftS }, PROFILE);
    expect(step?.hint).toBe(hint);
    expect(step?.primary).toBeUndefined();
    expect(step?.secondary?.action).toBe('start');
    expect(step?.stop).toBeDefined();
  });

  it('offers Charge soon once the hold is over, then Start as the one primary', () => {
    const ready = autoFlowStep(PREHEAT, { ...ON, preheatStep: 'add-beans' }, PROFILE);
    expect(ready?.chargeSoon).toBe(true);
    const cut = autoFlowStep(
      PREHEAT,
      { ...ON, preheatStep: 'charge-cut', preheatLeftS: 4 },
      PROFILE,
    );
    expect(cut).toMatchObject({
      primary: { action: 'start' },
      hint: 'Heater off · beans in 0:04.',
    });
    expect(cut?.chargeSoon).toBeUndefined();
    const now = autoFlowStep(PREHEAT, { ...ON, preheatStep: 'beans-in' }, PROFILE);
    expect(now?.primary?.action).toBe('start');
  });

  it('says what the running step is, and what comes next', () => {
    const status = { ...ON, phaseName: 'Yellowing', nextPhaseAtC: 165 };
    expect(autoFlowStep(ROASTING, status, PROFILE)).toMatchObject({
      primary: { action: 'first-crack' },
      secondary: { action: 'drop' },
      hint: 'Yellowing · next at 165 °C',
    });
    expect(autoFlowStep(ROASTING, { ...status, nextPhaseAtC: null }, PROFILE)?.hint).toBe(
      'Yellowing',
    );
  });

  it('says the stall guard is holding the fan', () => {
    const status = { ...ON, phaseName: 'Maillard', stallTripped: true };
    expect(autoFlowStep(ROASTING, status, PROFILE)?.hint).toBe('Maillard · RoR low · fan held');
  });

  it('says when Development drops by itself', () => {
    const status = { ...ON, phaseName: 'Development' };
    expect(autoFlowStep(DEVELOPMENT, status, PROFILE)).toMatchObject({
      primary: { action: 'drop' },
      hint: 'Development · drops at 1:30 or 200 °C',
    });
  });
});
