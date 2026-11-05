import { describe, expect, it } from 'vitest';
import { controlsAccess } from './controls-access';

describe('controlsAccess', () => {
  it.each([
    ['ready', false, true, true],
    ['preheat', true, true, false],
    ['roasting', true, true, false],
    ['development', true, true, false],
    ['cooling', false, false, false],
    ['done', false, true, true],
  ] as const)(
    'Guided in %s: heater %s, fan %s, cooling switch %s',
    (phase, heater, fan, showCooling) => {
      expect(controlsAccess('guided', phase, true)).toEqual({
        heater,
        fan,
        showCooling,
        switches: true,
      });
    },
  );

  it('Full control: everything in any state, cooling switch shown', () => {
    expect(controlsAccess('full', 'cooling', true)).toEqual({
      heater: true,
      fan: true,
      showCooling: true,
      switches: true,
    });
  });

  it('nothing takes input while disconnected', () => {
    expect(controlsAccess('full', 'roasting', false)).toMatchObject({
      heater: false,
      fan: false,
      switches: false,
    });
    expect(controlsAccess('guided', 'done', false)).toMatchObject({ heater: false, fan: false });
  });
});
