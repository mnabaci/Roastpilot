import type { RoastSummary } from '@roastpilot/shared';

const HEADER = [
  'id',
  'started_at',
  'ended_at',
  'bean',
  'profile',
  'batch_g',
  'roasted_g',
  'first_crack_s',
  'drop_s',
  'drop_c',
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

/** Saved roasts as CSV; the byte order mark makes Excel read accents in notes and bean names. */
export function roastsToCsv(
  roasts: readonly RoastSummary[],
  beanNames: ReadonlyMap<number, string>,
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
      numberCell(roast.dropTemp),
      numberCell(roast.rating),
      roast.isFavourite ? 'yes' : 'no',
      textCell(roast.notes),
    ].join(','),
  );
  return `\uFEFF${[HEADER.join(','), ...rows].join('\r\n')}\r\n`;
}
