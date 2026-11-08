import {
  diffFromUnit,
  diffPlain,
  fromUnit,
  tempPlain,
  type TemperatureUnit,
} from '@roastpilot/shared';
import { reader, type Reader } from './draft-reader';

/**
 * The °C values a draft was made from. A cell still showing one of them reads back as that exact
 * value, so an edit elsewhere in °F never nudges the rest by the rounding (92 °C stays 92, not
 * 92.2 from 198 °F).
 */
export interface ExactValues {
  temps: readonly number[];
  rates: readonly number[];
}

export const NO_EXACT: ExactValues = { temps: [], rates: [] };

/** A reader that also takes typed temperatures and rates back to °C (docs/spec/ui.md, Units). */
export type UnitReader = Reader & {
  /** A temperature: °F − 32, ÷ 1.8, kept to 0.1 °C. */
  temp: (key: string, text: string) => number;
  /** A rate or difference (RoR): ÷ 1.8 only, never − 32. */
  rate: (key: string, text: string) => number;
};

export function unitReader(unit: TemperatureUnit, exact: ExactValues = NO_EXACT): UnitReader {
  const read = reader();
  // Two values that show the same (204.4 and 204.5 °C both as 400 °F): the first one wins, so a
  // later one never takes the place of the value the cell came from.
  const shown = (values: readonly number[], say: (c: number) => string) =>
    new Map(values.toReversed().map((c) => [say(c), c]));
  const temps = shown(exact.temps, (c) => tempPlain(c, unit));
  const rates = shown(exact.rates, (c) => diffPlain(c, unit));
  return {
    ...read,
    temp: (key, text) => temps.get(text.trim()) ?? fromUnit(read.number(key, text), unit),
    rate: (key, text) => rates.get(text.trim()) ?? diffFromUnit(read.number(key, text), unit),
  };
}
