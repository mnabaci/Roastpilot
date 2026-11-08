import { rateOfRise, rorReadings } from '@roastpilot/core';
import {
  diffNumber,
  formatTemp,
  type Reading,
  type RoastDetail,
  type SavedEvent,
  type TemperatureUnit,
} from '@roastpilot/shared';
import { formatClock, type EventRow } from '@roastpilot/ui';
import { savedAsLive } from './saved-roast-chart';

const EVENT_LABEL: Readonly<Record<SavedEvent['kind'], string>> = {
  charge: 'Charge',
  'turning-point': 'Turning point',
  'dry-end': 'Dry end',
  phase: 'Step',
  override: 'Override',
  'stall-guard': 'Stall guard',
  mode: 'Mode',
  'coach-applied': 'Coach applied',
  'first-crack': 'First crack',
  drop: 'Drop',
  'cool-end': 'Cool end',
  end: 'End',
};

const percent = (v: number | undefined) => (v === undefined ? undefined : `${String(v)} %`);

/** The last reading at or before `atMs`: what the roaster said at that moment. */
function readingAt(readings: readonly Reading[], atMs: number): Reading | undefined {
  let found: Reading | undefined;
  for (const r of readings) {
    if (r.atMs > atMs) break;
    found = r;
  }
  return found;
}

/**
 * The History events table (docs/spec/ui.md, History screen): each event with BT, RoR, heater and
 * fan at that moment, read from the saved samples. RoR only between charge and drop, as on the
 * chart; a value the roast didn't have is undefined.
 */
export function eventRows(detail: RoastDetail, unit: TemperatureUnit): EventRow[] {
  const { readings } = savedAsLive(detail);
  const dropMs = detail.dropTimeS === null ? Infinity : detail.dropTimeS * 1000;
  return [...detail.events]
    .sort((a, b) => a.tS - b.tS)
    .map((event) => {
      const atMs = Math.round(event.tS * 1000);
      const values = readingAt(readings, atMs)?.values;
      const upTo = readings.filter((r) => r.atMs <= atMs);
      const ror = atMs > 0 && atMs <= dropMs ? rateOfRise(rorReadings(upTo, 0)) : undefined;
      const bt = event.bt ?? values?.bt;
      return {
        event: [EVENT_LABEL[event.kind], event.detail].filter(Boolean).join(' · '),
        time: formatClock(event.tS),
        bt: bt === undefined ? undefined : formatTemp(bt, unit, 1),
        // A rate: × 1.8 in °F, never + 32.
        ror: ror === undefined ? undefined : diffNumber(ror, unit, 1),
        heater: percent(values?.heater),
        fan: percent(values?.fan),
      };
    });
}
