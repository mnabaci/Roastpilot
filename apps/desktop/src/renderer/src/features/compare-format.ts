import { formatTemp, tempSymbol, toUnit, type TemperatureUnit } from '@roastpilot/shared';
import { formatClock, type CompareTableRow } from '@roastpilot/ui';

/** A signed number as tables show it: `+2`, `−1.0` (a real minus), `0` with no sign. */
export function signed(text: string): string {
  if (Number(text) === 0) return text.replace('-', '');
  return text.startsWith('-') ? `−${text.slice(1)}` : `+${text}`;
}

/** Clocks show whole seconds, rounded down: the difference is of the times as shown. */
export const clockDiff = (a: number, b: number): string => {
  const whole = Math.floor(a) - Math.floor(b);
  const sign = whole > 0 ? '+' : whole < 0 ? '−' : '';
  return `${sign}${formatClock(Math.abs(whole))}`;
};

/** °C to 0.1, °F whole: the numbers on the rest of the screen. */
export const tempDecimals = (unit: TemperatureUnit) => (unit === 'f' ? 0 : 1);

/**
 * The difference of two temperatures as shown, so a column adds up: °C to 0.1, °F whole. It is a
 * difference, so it carries no + 32 (docs/spec/ui.md, Units).
 */
export const tempDiff = (a: number, b: number, unit: TemperatureUnit): string => {
  const scale = 10 ** tempDecimals(unit);
  const shown = (c: number) => Math.round(toUnit(c, unit) * scale);
  const d = (shown(a) - shown(b)) / scale;
  return `${signed(d.toFixed(tempDecimals(unit)))} ${tempSymbol(unit)}`;
};

export const both = <T>(a: T | null | undefined, b: T | null | undefined): [T, T] | undefined =>
  a === null || a === undefined || b === null || b === undefined ? undefined : [a, b];

/** A moment of the roast: when it happened and how hot it was then. */
export interface Moment {
  tS: number;
  c: number | null;
}

/** A row of moments: `9:00 · 201.3 °C` each, and the difference of time and temperature. */
export function momentRow(
  label: string,
  own: Moment | undefined,
  other: Moment | undefined,
  unit: TemperatureUnit,
): CompareTableRow {
  const show = (m: Moment | undefined) =>
    m &&
    [formatClock(m.tS), m.c === null ? undefined : formatTemp(m.c, unit, tempDecimals(unit))]
      .filter(Boolean)
      .join(' · ');
  const temps = both(own?.c, other?.c);
  const diff =
    own && other
      ? [clockDiff(own.tS, other.tS), temps && tempDiff(temps[0], temps[1], unit)]
          .filter(Boolean)
          .join(' · ')
      : undefined;
  return { label, own: show(own), other: show(other), diff };
}
