import { tempSymbol, type TemperatureUnit } from '@roastpilot/shared';
import type { TextCell } from './roaster-draft';

export interface FieldGroup {
  title: string;
  /** One line under the title. */
  hint?: string;
  cells: readonly { key: TextCell; label: string; unit?: string }[];
}

/** What most people set (docs/spec/ui.md, Roasters screen), temperatures in `unit`. */
export const everydayFields = (unit: TemperatureUnit): readonly FieldGroup[] => [
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
      { key: 'maxTempC', label: 'Max temp', unit: tempSymbol(unit) },
      { key: 'maxTimeMin', label: 'Max time', unit: 'min' },
      { key: 'tempOffsetC', label: 'Temp offset', unit: tempSymbol(unit) },
    ],
  },
  {
    title: 'Preheat hold',
    hint: 'Next batch: within 20 min of the last roast',
    cells: [
      { key: 'hold', label: 'First batch' },
      { key: 'nextHold', label: 'Next batch' },
    ],
  },
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
      { key: 'curveKp', label: 'Push (Kp)' },
      { key: 'curveKi', label: 'Catch-up (Ki)' },
      { key: 'curveLimitPct', label: 'Most it may change (limit)', unit: '%' },
      { key: 'curveLookAheadS', label: 'Look ahead', unit: 's' },
      { key: 'curvePullPerC', label: 'Pull to the curve', unit: 'per °C' },
      { key: 'curveSlewPct', label: 'Heater change per 10 s', unit: '%' },
    ],
  },
];

export const TUNING_HINT =
  'Push (Kp): how hard the heater reacts to being off target · Catch-up (Ki): closes a gap that stays';

/** The gains tune the controller, not a reading: they stay per °C in °F (docs/spec/ui.md, Units). */
export const tuningHint = (unit: TemperatureUnit): string =>
  unit === 'f' ? `${TUNING_HINT} · gains stay per °C` : TUNING_HINT;
