import { toUnit, type RoastSummary, type TemperatureUnit } from '@roastpilot/shared';

/** The columns; the drop temperature's says its unit, `drop_c` or `drop_f` (data-model.md). */
const header = (unit: TemperatureUnit) => [
  'id',
  'started_at',
  'ended_at',
  'bean',
  'profile',
  'batch_g',
  'roasted_g',
  'first_crack_s',
  'drop_s',
  `drop_${unit}`,
  'rating',
  'favourite',
  'notes',
];

/** Spreadsheets run a cell starting with these as a formula, and notes can come from imported files. */
const FORMULA_START = /^[=+\-@\t\r]/;

function textCell(value: string | null | undefined): string {
  const text = value ?? '';
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

const numberCell = (value: number | null) => (value === null ? '' : String(value));

/** A temperature in the unit: °C as saved, °F to 0.1. */
const tempCell = (c: number | null, unit: TemperatureUnit) =>
  c === null || unit === 'c' ? numberCell(c) : String(Math.round(toUnit(c, unit) * 10) / 10);

/**
 * Saved roasts as CSV, temperatures in the unit shown (docs/spec/ui.md, Units); the byte order
 * mark makes Excel read accents in notes and bean names.
 */
export function roastsToCsv(
  roasts: readonly RoastSummary[],
  beanNames: ReadonlyMap<number, string>,
  unit: TemperatureUnit,
): string {
  const rows = roasts.map((roast) =>
    [
      String(roast.id),
      textCell(roast.startedAt),
      textCell(roast.endedAt),
      textCell(roast.beanId === null ? null : beanNames.get(roast.beanId)),
      textCell(roast.profileName),
      numberCell(roast.batchG),
      numberCell(roast.roastedG),
      numberCell(roast.fcTimeS),
      numberCell(roast.dropTimeS),
      tempCell(roast.dropTemp, unit),
      numberCell(roast.rating),
      roast.isFavourite ? 'yes' : 'no',
      textCell(roast.notes),
    ].join(','),
  );
  return `\uFEFF${[header(unit).join(','), ...rows].join('\r\n')}\r\n`;
}
