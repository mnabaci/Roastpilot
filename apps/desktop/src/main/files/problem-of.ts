/** A zod error, as zod's own `issues` list has it. */
interface Issues {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}

/** A field's name as its screen labels it; a field with none here is left unnamed. */
const FIELD_NAMES: Readonly<Record<string, string>> = {
  name: 'Name',
  origin: 'Origin',
  process: 'Process',
  altitudeM: 'Altitude',
  densityGL: 'Density',
  moisturePct: 'Moisture',
  screen: 'Screen size',
  lowStockG: 'Low stock',
  batchG: 'Batch',
  chargeC: 'Charge temp',
  dryEndC: 'Dry end',
  devTimeS: 'Development',
  capC: 'BT cap',
  batchMinG: 'Batch min',
  batchIdealG: 'Batch ideal',
  batchMaxG: 'Batch max',
  maxTempC: 'Max temp',
  maxTimeS: 'Max time',
  tempOffsetC: 'Temp offset',
  drumSpeedPct: 'Drum speed',
};

/** Lists whose rows the screens number from 1. */
const ROWS: Readonly<Record<string, string>> = { phases: 'Step', curve: 'Curve point' };

function placeOf([field, index]: readonly PropertyKey[]): string | undefined {
  if (typeof field !== 'string') return undefined;
  const row = ROWS[field];
  if (row && typeof index === 'number') return `${row} ${String(index + 1)}`;
  return FIELD_NAMES[field];
}

/** Why an item was refused, in one line: the first problem, after the field it is in. */
export function problemOf({ issues }: Issues): string {
  const [first] = issues;
  if (!first) return 'Not a valid item';
  const place = placeOf(first.path);
  return place ? `${place}: ${first.message}` : first.message;
}
