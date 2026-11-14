import { DEFAULT_TC4_WIRING, Tc4WiringSchema } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import {
  baudOf,
  etOptions,
  inputRole,
  minFanOptions,
  withBt,
  withFan,
  withHeater,
} from './wiring-choices';

describe('wiring choices', () => {
  it('swaps BT and ET when the bean probe takes the ET input', () => {
    const wiring = withBt(DEFAULT_TC4_WIRING, 1);
    expect(wiring).toMatchObject({ btInput: 1, etInput: 2 });
    expect(Tc4WiringSchema.safeParse(wiring).success).toBe(true);
  });

  it('keeps ET where it was when the bean probe moves to a free input', () => {
    expect(withBt(DEFAULT_TC4_WIRING, 3)).toMatchObject({ btInput: 3, etInput: 1 });
  });

  it("offers ET every input but the bean probe's, and None", () => {
    const options = etOptions(DEFAULT_TC4_WIRING);
    expect(options.map((o) => o.label)).toEqual(['None', 'TC1', 'TC2', 'TC3', 'TC4']);
    expect(options.find((o) => o.label === 'TC2')).toMatchObject({ disabled: true });
  });

  it('moves the fan off IO3 when the heater takes it', () => {
    const wiring = withHeater({ ...DEFAULT_TC4_WIRING, fanOutput: 'IO3' }, 'IO3');
    expect(wiring).toMatchObject({ heaterOutput: 'IO3', fanOutput: 'OT2' });
    expect(Tc4WiringSchema.safeParse(wiring).success).toBe(true);
  });

  it('moves the heater off IO3 when the fan takes it', () => {
    const wiring = withFan({ ...DEFAULT_TC4_WIRING, heaterOutput: 'IO3' }, 'IO3');
    expect(wiring).toMatchObject({ heaterOutput: 'OT1', fanOutput: 'IO3' });
    expect(Tc4WiringSchema.safeParse(wiring).success).toBe(true);
  });

  it('reads a baud back from its option, and nothing else', () => {
    expect(baudOf('57600')).toBe(57600);
    expect(baudOf('1')).toBeUndefined();
  });

  it('names the inputs by their role', () => {
    expect([1, 2, 3].map((i) => inputRole(DEFAULT_TC4_WIRING, i))).toEqual(['ET', 'BT', undefined]);
  });

  it('offers the minimum fan as Off, then 5 % steps', () => {
    expect(minFanOptions.slice(0, 3).map((o) => o.label)).toEqual(['Off', '5 %', '10 %']);
    expect(minFanOptions.at(-1)?.label).toBe('100 %');
  });
});
