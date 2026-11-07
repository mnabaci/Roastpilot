import type { TextCell } from './roaster-draft';

export interface FieldGroup {
  title: string;
  /** One line under the title. */
  hint?: string;
  cells: readonly { key: TextCell; label: string; unit?: string }[];
}

/** What most people set (docs/spec/ui.md, Roasters screen). */
export const EVERYDAY_FIELDS: readonly FieldGroup[] = [
  {
    title: 'Batch size',
    cells: [
      { key: 'batchMinG', label: 'Min', unit: 'g' },
      { key: 'batchIdealG', label: 'Ideal', unit: 'g' },
      { key: 'batchMaxG', label: 'Max', unit: 'g' },
    ],
  },
  {
    title: 'Limits and calibration',
    cells: [
      { key: 'maxTempC', label: 'Max temp', unit: '°C' },
      { key: 'maxTimeMin', label: 'Max time', unit: 'min' },
      { key: 'tempOffsetC', label: 'Temp offset', unit: '°C' },
    ],
  },
  { title: 'Preheat', cells: [{ key: 'hold', label: 'Hold' }] },
];

/** Only on a roaster whose drum has a speed (docs/spec/roasters.md, Drum speed). */
export const DRUM_FIELDS: FieldGroup = {
  title: 'Drum',
  hint: 'Usual speed · from Preheat, and while cooling',
  cells: [{ key: 'drumSpeedPct', label: 'Drum speed', unit: '%' }],
};

/** The PID gains in plain words, each with its usual name in brackets for those who know it. */
export const TUNING_FIELDS: readonly FieldGroup[] = [
  {
    title: 'Preheat',
    cells: [
      { key: 'preheatKp', label: 'Push (Kp)' },
      { key: 'preheatKi', label: 'Catch-up (Ki)' },
    ],
  },
  {
    title: 'Reaching step temperatures',
    cells: [
      { key: 'targetKp', label: 'Push (Kp)' },
      { key: 'targetKi', label: 'Catch-up (Ki)' },
      { key: 'targetLimitPct', label: 'Most it may change (limit)', unit: '%' },
    ],
  },
  {
    title: 'Following a curve',
    cells: [
      { key: 'followKp', label: 'Push (Kp)' },
      { key: 'followKi', label: 'Catch-up (Ki)' },
    ],
  },
];

export const TUNING_HINT =
  'Push (Kp): how hard the heater reacts to being off target · Catch-up (Ki): closes a gap that stays';
