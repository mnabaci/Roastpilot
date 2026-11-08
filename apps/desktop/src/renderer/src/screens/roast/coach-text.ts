import {
  formatTemp,
  type CoachAdvice,
  type CoachChange,
  type CoachSetting,
  type CoachStatus,
  type TemperatureUnit,
} from '@roastpilot/shared';
import { formatClock, type CoachCardChange } from '@roastpilot/ui';

/** One row per output it changes, heater first, each in its slider's colour. */
export function coachChanges({
  heater,
  fan,
}: Pick<CoachSetting, 'heater' | 'fan'>): CoachCardChange[] {
  const row = (name: string, tone: CoachCardChange['tone'], change: CoachChange | undefined) =>
    change ? [{ name, from: change.from, to: change.to, tone }] : [];
  return [...row('Heater', 'heat', heater), ...row('Fan', 'air', fan)];
}

/** A heads-up's one line (docs/spec/manual-mode.md, Coach). */
export function headsUpLine(
  advice: Exclude<CoachAdvice, CoachSetting>,
  unit: TemperatureUnit,
): string {
  const inS = `~${String(advice.inS)} s`;
  switch (advice.kind) {
    case 'first-crack-soon':
      return `First crack in ${inS} · listen`;
    case 'drop-soon':
      return `Drop in ${inS} · ${formatClock(advice.devTimeS)} development`;
    case 'cap-soon':
      return `BT cap ${formatTemp(advice.capC, unit)} in ${inS}`;
  }
}

/** "needs calibration" (the setup card names the profile), or undefined for one that doesn't. */
export const calibrationNote = ({ needsCalibration }: CoachStatus): string | undefined =>
  needsCalibration === null ? undefined : 'needs calibration';
