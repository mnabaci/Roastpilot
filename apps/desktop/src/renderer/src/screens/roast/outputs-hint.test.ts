import { describe, expect, it } from 'vitest';
import { outputsHint, type OutputsHintInput } from './outputs-hint';

const base: OutputsHintInput = {
  locked: false,
  connected: true,
  autoStopped: false,
  phase: 'roasting',
  access: { heater: true },
  heaterPct: 60,
  drumPct: 60,
};

describe('outputsHint', () => {
  it('says nothing while all is as expected', () => {
    expect(outputsHint(base)).toBeUndefined();
  });

  it('a heater lock comes first, then a stopped Auto', () => {
    expect(outputsHint({ ...base, locked: true, autoStopped: true, drumPct: 0 })).toBe(
      'Heater locked · acknowledge above',
    );
    expect(outputsHint({ ...base, autoStopped: true, drumPct: 0 })).toBe(
      'Auto stopped · heater and fan are yours',
    );
  });

  it('warns of heat with the drum off', () => {
    expect(outputsHint({ ...base, drumPct: 0 })).toBe('Drum is off');
  });

  it('says why the heater is shut, by phase', () => {
    const shut = { ...base, access: { heater: false }, heaterPct: 0 };
    expect(outputsHint({ ...shut, phase: 'ready' })).toBe('Heater waits for Preheat');
    expect(outputsHint({ ...shut, phase: 'cooling' })).toBe(
      'Cooling beans · heater off, fan at 100%',
    );
  });

  it('reads nothing into the last known values while the connection is lost', () => {
    expect(
      outputsHint({ ...base, connected: false, drumPct: 0, access: { heater: false } }),
    ).toBeUndefined();
  });
});
