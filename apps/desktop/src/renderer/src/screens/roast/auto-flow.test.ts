import { AUTO_OFF, READY_ROAST, type AutoProfile, type AutoStatus } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { autoFlowStep } from './auto-flow';
import { END_ROAST } from './flow-step';

const PROFILE = { chargeC: 180, devTimeS: 90, capC: 200 } as AutoProfile;
const ON: AutoStatus = { ...AUTO_OFF, enabled: true };
const PREHEAT = { ...READY_ROAST, phase: 'preheat' } as const;
const ROASTING = { ...READY_ROAST, phase: 'roasting' } as const;
const DEVELOPMENT = { ...READY_ROAST, phase: 'development' } as const;

describe('autoFlowStep', () => {
  it('leaves the normal flow alone in a manual roast, or when nothing is driven', () => {
    expect(autoFlowStep(ROASTING, AUTO_OFF, PROFILE)).toBeUndefined();
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
    ['cool', 'Cooling to 160 °C first · then climbs to 180 °C for an even start'],
    ['climb', 'Heating to 180 °C.'],
  ] as const)('in %s offers no Start: the drum is not ready for beans', (preheatStep, hint) => {
    const step = autoFlowStep(PREHEAT, { ...ON, preheatStep, preheatLeftS: null }, PROFILE);
    expect(step?.hint).toBe(hint);
    expect(step?.primary).toBeUndefined();
    expect(step?.secondary).toBeUndefined();
    expect(step?.stop).toBeDefined();
  });

  it('says the cool step in °F, from the profile', () => {
    const step = autoFlowStep(PREHEAT, { ...ON, preheatStep: 'cool' }, PROFILE, { unit: 'f' });
    expect(step?.hint).toBe('Cooling to 320 °F first · then climbs to 356 °F for an even start');
  });

  it('offers no Start while the preheat is starting', () => {
    expect(autoFlowStep(PREHEAT, { ...ON, preheatStep: null }, PROFILE)?.secondary).toBeUndefined();
  });

  it('from the hold keeps Start as the second button, so you can still go early', () => {
    const step = autoFlowStep(PREHEAT, { ...ON, preheatStep: 'hold', preheatLeftS: 90 }, PROFILE);
    expect(step?.hint).toBe('Holding 180 °C · 1:30 left.');
    expect(step?.primary).toBeUndefined();
    expect(step?.secondary?.action).toBe('start');
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

  it('says the stall guard is adding heat', () => {
    const status = { ...ON, phaseName: 'Maillard', stallTripped: true };
    expect(autoFlowStep(ROASTING, status, PROFILE)?.hint).toBe('Maillard · RoR low · more heat');
  });

  it('counts down to the drop in Development', () => {
    const status = { ...ON, phaseName: 'Development' };
    expect(autoFlowStep(DEVELOPMENT, status, PROFILE, { developmentS: 47 })).toMatchObject({
      primary: { action: 'drop' },
      hint: 'Development · drops in 0:43 or at 200 °C',
    });
    expect(autoFlowStep(DEVELOPMENT, status, PROFILE, { developmentS: 95 })?.hint).toBe(
      'Development · drops in 0:00 or at 200 °C',
    );
  });

  describe('stopped', () => {
    it('after a preheat ran out, offers no Start: the drum is cooling', () => {
      const step = autoFlowStep(PREHEAT, { ...ON, stopReason: 'preheat-limit' }, PROFILE);
      expect(step).toEqual({
        stop: END_ROAST,
        hint: 'Preheat ran out · heater off · stop, then Preheat again.',
      });
    });

    it('in a preheat for another reason, the outputs and Start are yours', () => {
      const step = autoFlowStep(PREHEAT, { ...ON, stopReason: 'safety-stop' }, PROFILE);
      expect(step).toMatchObject({
        secondary: { action: 'start' },
        hint: 'Safety stop · heater and fan are yours.',
      });
    });

    it.each([
      ['heater-locked', 'Heater locked · you drop.'],
      ['disconnected', 'Roaster disconnected · you drop.'],
      ['tick-failed', 'Auto failed · you drop.'],
    ] as const)('mid-roast after %s, says why and that you drop', (stopReason, hint) => {
      expect(autoFlowStep(ROASTING, { ...ON, stopReason }, PROFILE)).toMatchObject({
        primary: { action: 'first-crack' },
        secondary: { action: 'drop' },
        hint,
      });
      expect(autoFlowStep(DEVELOPMENT, { ...ON, stopReason }, PROFILE)).toMatchObject({
        primary: { action: 'drop' },
        hint,
      });
    });

    it('leaves cooling alone', () => {
      const cooling = { ...READY_ROAST, phase: 'cooling' } as const;
      expect(autoFlowStep(cooling, { ...ON, stopReason: 'lost' }, PROFILE)).toBeUndefined();
    });
  });

  describe('turned off mid-roast', () => {
    const off = { kind: 'mode', atMs: 300_000, bt: 160, detail: 'manual' } as const;
    const on = { ...off, detail: 'auto' } as const;

    it('says the heater stays where it was and that you drop', () => {
      const roasting = { ...ROASTING, events: [off] };
      expect(autoFlowStep(roasting, AUTO_OFF, PROFILE, { heaterPct: 85 })).toMatchObject({
        primary: { action: 'first-crack' },
        secondary: { action: 'drop' },
        hint: 'Manual · heater stays 85 % · you drop.',
      });
      const developing = { ...DEVELOPMENT, events: [off] };
      expect(autoFlowStep(developing, AUTO_OFF, PROFILE)?.hint).toBe(
        'Manual · heater stays · you drop.',
      );
    });

    it('only when the last switch was to Manual', () => {
      expect(autoFlowStep({ ...ROASTING, events: [off, on] }, AUTO_OFF, PROFILE)).toBeUndefined();
    });
  });
});
