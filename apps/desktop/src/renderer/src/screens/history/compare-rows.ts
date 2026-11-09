import {
  toUnit,
  formatTemp,
  tempSymbol,
  type Bean,
  type RoastDetail,
  type SavedEvent,
  type TemperatureUnit,
} from '@roastpilot/shared';
import { formatClock, formatNumber, type CompareTableRow } from '@roastpilot/ui';
import { weightLossPct } from '../../features/roast-result';
import { howItRan } from './history-format';

/** A signed number as the table shows it: `+2`, `−1.0` (a real minus), `0` with no sign. */
function signed(text: string): string {
  if (Number(text) === 0) return text.replace('-', '');
  return text.startsWith('-') ? `−${text.slice(1)}` : `+${text}`;
}

/** Clocks show whole seconds, rounded down: the difference is of the times as shown. */
const clockDiff = (a: number, b: number): string => {
  const whole = Math.floor(a) - Math.floor(b);
  const sign = whole > 0 ? '+' : whole < 0 ? '−' : '';
  return `${sign}${formatClock(Math.abs(whole))}`;
};

/** °C to 0.1, °F whole: the numbers on the rest of the screen. */
const tempDecimals = (unit: TemperatureUnit) => (unit === 'f' ? 0 : 1);

/**
 * The difference of two temperatures as shown, so the column adds up: °C to 0.1, °F whole. It is a
 * difference, so it carries no + 32 (docs/spec/ui.md, Units).
 */
const tempDiff = (a: number, b: number, unit: TemperatureUnit): string => {
  const scale = 10 ** tempDecimals(unit);
  const shown = (c: number) => Math.round(toUnit(c, unit) * scale);
  const d = (shown(a) - shown(b)) / scale;
  return `${signed(d.toFixed(tempDecimals(unit)))} ${tempSymbol(unit)}`;
};

/** The difference of two percentages as shown, to 0.1. */
const percentDiff = (a: number, b: number): string =>
  `${signed(((Math.round(a * 10) - Math.round(b * 10)) / 10).toFixed(1))} %`;

const both = <T>(a: T | null | undefined, b: T | null | undefined): [T, T] | undefined =>
  a === null || a === undefined || b === null || b === undefined ? undefined : [a, b];

/** A moment of the roast: when it happened and how hot it was then. */
interface Moment {
  tS: number;
  c: number | null;
}

const eventMoment = (detail: RoastDetail, kind: SavedEvent['kind']): Moment | undefined => {
  const event = detail.events.find((e) => e.kind === kind);
  return event ? { tS: event.tS, c: event.bt } : undefined;
};

const firstCrack = (detail: RoastDetail): Moment | undefined =>
  detail.fcTimeS === null
    ? eventMoment(detail, 'first-crack')
    : { tS: detail.fcTimeS, c: detail.fcTemp ?? eventMoment(detail, 'first-crack')?.c ?? null };

function momentRow(
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

/** Development: first crack to drop, and its share of the whole roast. */
function development(detail: RoastDetail): { s: number; pct: number } | undefined {
  const times = both(detail.fcTimeS, detail.dropTimeS);
  if (!times || times[1] <= 0) return undefined;
  const s = times[1] - times[0];
  return { s, pct: Math.round((s / times[1]) * 100) };
}

function developmentRow(own: RoastDetail, other: RoastDetail): CompareTableRow {
  const show = (d: { s: number; pct: number } | undefined) =>
    d && `${formatClock(d.s)} · ${String(d.pct)} %`;
  const pair = both(development(own), development(other));
  return {
    label: 'Development',
    own: show(development(own)),
    other: show(development(other)),
    diff:
      pair && `${clockDiff(pair[0].s, pair[1].s)} · ${signed(String(pair[0].pct - pair[1].pct))} %`,
  };
}

/** A row of plain numbers: how each shows, and how a difference shows. */
function numberRow(
  label: string,
  own: number | null | undefined,
  other: number | null | undefined,
  show: (v: number) => string,
  showDiff: (a: number, b: number) => string,
): CompareTableRow {
  const pair = both(own, other);
  return {
    label,
    own: own === null || own === undefined ? undefined : show(own),
    other: other === null || other === undefined ? undefined : show(other),
    diff: pair && showDiff(pair[0], pair[1]),
  };
}

const percent = (v: number) => `${formatNumber(v, 1) ?? ''} %`;

/**
 * History's comparison table (docs/spec/ui.md, History › Compare): the open roast and the compared
 * one side by side, each difference this roast minus the compared one, in neutral words: faster or
 * hotter isn't better. Profile and Bean have no difference.
 */
export function compareRows(
  own: RoastDetail,
  other: RoastDetail,
  unit: TemperatureUnit,
  beans: readonly Pick<Bean, 'id' | 'name'>[],
): CompareTableRow[] {
  const beanName = (d: RoastDetail) => beans.find((b) => b.id === d.beanId)?.name ?? 'No bean';
  const temp = (c: number) => formatTemp(c, unit, tempDecimals(unit));
  return [
    numberRow('Total', own.dropTimeS, other.dropTimeS, formatClock, clockDiff),
    momentRow(
      'Turning point',
      eventMoment(own, 'turning-point'),
      eventMoment(other, 'turning-point'),
      unit,
    ),
    momentRow('Dry end', eventMoment(own, 'dry-end'), eventMoment(other, 'dry-end'), unit),
    momentRow('First crack', firstCrack(own), firstCrack(other), unit),
    developmentRow(own, other),
    numberRow('Drop temp', own.dropTemp, other.dropTemp, temp, (a, b) => tempDiff(a, b, unit)),
    numberRow('Weight loss', weightLossPct(own), weightLossPct(other), percent, percentDiff),
    {
      ...numberRow('Rating', own.rating, other.rating, String, (a, b) => signed(String(a - b))),
      stars: true,
    },
    { label: 'Profile', own: howItRan(own), other: howItRan(other), diff: undefined },
    { label: 'Bean', own: beanName(own), other: beanName(other), diff: undefined },
  ];
}
