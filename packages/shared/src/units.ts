import { z } from 'zod';

/**
 * What temperatures are shown and typed in (docs/spec/ui.md, Units). Everything is stored and
 * worked out in °C; only the screen converts.
 */
export const TemperatureUnitSchema = z.enum(['c', 'f']);
export type TemperatureUnit = z.infer<typeof TemperatureUnitSchema>;

const roundTo = (value: number, decimals: number): number => {
  const scale = 10 ** decimals;
  const rounded = Math.round(value * scale) / scale;
  // A value that rounds to zero is 0, never -0.
  return rounded === 0 ? 0 : rounded;
};

/** Fixed decimals, never `-0.0`. */
const fixed = (value: number, decimals: number): string =>
  roundTo(value, decimals).toFixed(decimals);

/** A temperature (a reading, a target, a limit) in the unit: 200 °C is 392 °F. */
export const toUnit = (c: number, unit: TemperatureUnit): number =>
  unit === 'f' ? c * 1.8 + 32 : c;

/**
 * A difference (RoR, a RoR range, an offset, "3 °C below") in the unit: × 1.8 only, never + 32.
 * 10 °C/min is 18 °F/min.
 */
export const diffToUnit = (c: number, unit: TemperatureUnit): number =>
  unit === 'f' ? c * 1.8 : c;

/** A typed temperature back to °C; °F is kept to 0.1 °C, so 400 °F shows as 400 °F again. */
export const fromUnit = (value: number, unit: TemperatureUnit): number =>
  unit === 'f' ? roundTo((value - 32) / 1.8, 1) : value;

/**
 * A typed difference back to °C, never − 32; °F is kept to 0.01 °C, so a difference shown to
 * 0.1 °F (3.5 °F) shows as typed again.
 */
export const diffFromUnit = (value: number, unit: TemperatureUnit): number =>
  unit === 'f' ? roundTo(value / 1.8, 2) : value;

export const tempSymbol = (unit: TemperatureUnit): string => (unit === 'f' ? '°F' : '°C');

export const rorSymbol = (unit: TemperatureUnit): string => `${tempSymbol(unit)}/min`;

/** A temperature's number: °C with `decimals`, °F always whole (docs/spec/ui.md, Units). */
export const tempNumber = (c: number, unit: TemperatureUnit, decimals = 0): string =>
  unit === 'f' ? fixed(toUnit(c, unit), 0) : fixed(c, decimals);

/** `392 °F`, `205.5 °C`. */
export const formatTemp = (c: number, unit: TemperatureUnit, decimals = 0): string =>
  `${tempNumber(c, unit, decimals)} ${tempSymbol(unit)}`;

/** A typed temperature as its field shows it: °C as stored, °F whole. */
export const tempPlain = (c: number, unit: TemperatureUnit): string =>
  unit === 'f' ? fixed(toUnit(c, unit), 0) : String(c);

/** A difference's number with the same decimals in both units: RoR 8.1 °C/min is 14.6 °F/min. */
export const diffNumber = (c: number, unit: TemperatureUnit, decimals: number): string =>
  fixed(diffToUnit(c, unit), decimals);

/** A difference as its field shows it: °C as stored, °F to 0.1 with no trailing `.0` (3.6, 18). */
export const diffPlain = (c: number, unit: TemperatureUnit): string =>
  unit === 'f' ? String(roundTo(diffToUnit(c, unit), 1)) : String(c);

// Messages written where the unit isn't known (zod rules, the coach in main) carry their
// temperatures as tokens; the screen says them in its unit with `sayInUnit`.

/** A temperature in a message: `Between ${tempInText(100)} and …`. */
export const tempInText = (c: number): string => `{temp:${String(c)}}`;

/** A difference in a message, said with its unit: `${diffInText(4)} below target`. */
export const diffInText = (c: number): string => `{diff:${String(c)}}`;

/** A RoR in a message, as a bare number written with its decimals: `RoR ${rateInText('6.5')}`. */
export const rateInText = (written: string): string => `{rate:${written}}`;

const TOKEN = /\{(temp|diff|rate):(-?\d+(?:\.\d+)?)\}/g;

/** A difference or rate in °F, with decimals only when °C had them. */
const sayDiff = (written: string, unit: TemperatureUnit): string => {
  if (unit === 'c') return written;
  const value = diffToUnit(Number(written), unit);
  return written.includes('.') ? fixed(value, 1) : String(roundTo(value, 1));
};

/** A message with its temperature tokens said in `unit`: `{temp:220}` is `428 °F`. */
export function sayInUnit(text: string, unit: TemperatureUnit): string {
  return text.replace(TOKEN, (_match, kind: string, written: string) => {
    if (kind === 'rate') return sayDiff(written, unit);
    const value =
      kind === 'temp'
        ? unit === 'c'
          ? written
          : tempNumber(Number(written), unit)
        : sayDiff(written, unit);
    return `${value} ${tempSymbol(unit)}`;
  });
}
