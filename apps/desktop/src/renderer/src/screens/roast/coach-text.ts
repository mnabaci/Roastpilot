import type { CoachAdvice, CoachChange, CoachSetting, CoachStatus } from '@roastpilot/shared';
import { formatClock } from '@roastpilot/ui';

const pct = (value: number) => `${String(Math.round(value))}%`;
const step = (name: string, change: CoachChange) =>
  `${name} ${pct(change.from)} → ${pct(change.to)}`;

/** One line per output it changes, heater first: ["Heater 65% → 75%", "Fan 50% → 40%"]. */
export function coachChanges({ heater, fan }: Pick<CoachSetting, 'heater' | 'fan'>): string[] {
  return [heater && step('Heater', heater), fan && step('Fan', fan)].filter(
    (line): line is string => Boolean(line),
  );
}

/** A heads-up's one line (docs/spec/manual-mode.md, Coach). */
export function headsUpLine(advice: Exclude<CoachAdvice, CoachSetting>): string {
  const inS = `~${String(advice.inS)} s`;
  switch (advice.kind) {
    case 'first-crack-soon':
      return `First crack in ${inS} · listen`;
    case 'drop-soon':
      return `Drop in ${inS} · ${formatClock(advice.devTimeS)} development`;
    case 'cap-soon':
      return `BT cap ${String(Math.round(advice.capC))} °C in ${inS}`;
  }
}

/** "Light · Steps needs calibration", or undefined for a profile that doesn't. */
export const calibrationNote = ({ needsCalibration }: CoachStatus): string | undefined =>
  needsCalibration === null ? undefined : `${needsCalibration} needs calibration`;
