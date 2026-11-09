/** A zod error, as zod's own `issues` list has it. */
interface Issues {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}

/** A field's name as its screen labels it; a field with none here is left unnamed. */
const FIELD_NAMES: Readonly<Record<string, string>> = {
  name: 'Name',
  origin: 'Origin',
  process: 'Process',
  variety: 'Variety',
  decaf: 'Decaf',
  supplier: 'Supplier',
  link: 'Order link',
  notes: 'Notes',
  profileName: 'Profile',
  schemaVersion: 'Profile version',
  needsCalibration: 'Needs calibration',
  model: 'Model',
  tuning: 'PID gains',
  coolerHelpsDrum: 'Bean cooler helps drum',
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

/** zod's own words ("Invalid input: expected number"), which are for developers, not roasters. */
const ZOD_WORDS = /^(Invalid |Too (big|small): |Unrecognized key)/;

/**
 * Why an item was refused, in one line: the first problem, after the field it is in. zod's own
 * words become "not valid"; a field with no name here is left unnamed.
 */
export function problemOf({ issues }: Issues): string {
  const [first] = issues;
  const own = first && !ZOD_WORDS.test(first.message) ? first.message : undefined;
  const place = first ? placeOf(first.path) : undefined;
  if (place) return `${place}: ${own ?? 'not valid'}`;
  return own ?? 'Not valid';
}
