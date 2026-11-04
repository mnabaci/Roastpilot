import { describe, expect, it } from 'vitest';
import { controlsAccess } from './controls-access';

describe('controlsAccess', () => {
  it.each([
    ['ready', false],
    ['preheat', true],
    ['roasting', true],
    ['development', true],
    ['cooling', false],
    ['done', false],
  ] as const)('Guided: heater and fan in %s → %s', (phase, outputs) => {
    expect(controlsAccess('guided', phase, true)).toEqual({
      outputs,
      showCooling: false,
      switches: true,
    });
  });

  it('Full control: everything in any state, cooling switch shown', () => {
    expect(controlsAccess('full', 'ready', true)).toEqual({
      outputs: true,
      showCooling: true,
      switches: true,
    });
  });

  it('nothing takes input while disconnected', () => {
    expect(controlsAccess('full', 'roasting', false)).toMatchObject({
      outputs: false,
      switches: false,
    });
  });
});
