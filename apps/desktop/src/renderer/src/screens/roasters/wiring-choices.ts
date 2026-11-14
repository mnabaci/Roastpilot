import { MIN_FAN_HEATING, TC4_BAUDS, TC4_INPUTS, type Tc4Wiring } from '@roastpilot/shared';
import type { SelectOption } from '@roastpilot/ui';

type Input = (typeof TC4_INPUTS)[number];
const inputName = (input: number) => `TC${String(input)}`;

/** The bean probe's input; picking ET's input swaps the two, so they never share one. */
export const btOptions: readonly SelectOption<string>[] = TC4_INPUTS.map((input) => ({
  value: String(input),
  label: inputName(input),
}));

/** ET's input, or None; the bean probe's input is taken. */
export function etOptions(wiring: Tc4Wiring): SelectOption<string>[] {
  return [
    { value: '0', label: 'None' },
    ...TC4_INPUTS.map((input) => ({
      value: String(input),
      label: inputName(input),
      ...(input === wiring.btInput ? { disabled: true, detail: 'The bean probe' } : {}),
    })),
  ];
}

export const baudOptions: readonly SelectOption<string>[] = TC4_BAUDS.map((baud) => ({
  value: String(baud),
  label: baud.toLocaleString('en-GB'),
}));

/** Off, then 5 % steps up to 100 %. */
export const minFanOptions: readonly SelectOption<string>[] = Array.from(
  { length: MIN_FAN_HEATING.maxPct / MIN_FAN_HEATING.stepPct + 1 },
  (_, i) => i * MIN_FAN_HEATING.stepPct,
).map((pct) => ({ value: String(pct), label: pct === 0 ? 'Off' : `${String(pct)} %` }));

export function withBt(wiring: Tc4Wiring, input: Input): Tc4Wiring {
  return {
    ...wiring,
    btInput: input,
    etInput: wiring.etInput === input ? wiring.btInput : wiring.etInput,
  };
}

/** The heater on IO3 moves a fan that was there to OT2, the only other fan output. */
export function withHeater(wiring: Tc4Wiring, output: Tc4Wiring['heaterOutput']): Tc4Wiring {
  return {
    ...wiring,
    heaterOutput: output,
    fanOutput: output === wiring.fanOutput ? 'OT2' : wiring.fanOutput,
  };
}

/** The fan on IO3 moves a heater that was there to OT1, the only other heater output. */
export function withFan(wiring: Tc4Wiring, output: Tc4Wiring['fanOutput']): Tc4Wiring {
  return {
    ...wiring,
    fanOutput: output,
    heaterOutput: output === wiring.heaterOutput ? 'OT1' : wiring.heaterOutput,
  };
}

/** The baud a select value names, if it is one the setting offers. */
export const baudOf = (value: string) => TC4_BAUDS.find((baud) => String(baud) === value);

/** What each input is, for the live readings: "BT", "ET" or nothing. */
export function inputRole(wiring: Tc4Wiring, input: number): 'BT' | 'ET' | undefined {
  if (input === wiring.btInput) return 'BT';
  return input === wiring.etInput ? 'ET' : undefined;
}

export const isInput = (value: number): value is Input =>
  (TC4_INPUTS as readonly number[]).includes(value);
