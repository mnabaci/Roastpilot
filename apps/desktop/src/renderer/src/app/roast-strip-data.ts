import {
  DEFAULT_TEMP_NAMES,
  type Reading,
  type RoastPhase,
  type RoastState,
} from '@roastpilot/shared';
import { formatClock, formatNumber, type RoastStripProps } from '@roastpilot/ui';
import { roastNumbers } from '../screens/roast/roast-numbers';
import { PHASE_LABEL } from './phase-label';

/** Dump beans leads the strip for the first minute of cooling: the one prompt that can't wait. */
export const DUMP_PROMPT_MS = 60_000;

const RUNNING: readonly RoastPhase[] = ['preheat', 'roasting', 'development', 'cooling'];

const clock = (s: number | undefined) => (s === undefined ? '–' : formatClock(s));
const percent = (v: number | undefined) => (v === undefined ? undefined : `${String(v)} %`);

/**
 * What the roast strip shows on the other screens (docs/spec/ui.md, Roast strip), or undefined
 * when no roast is running and the roaster isn't cooling down.
 */
export function roastStripData(
  roast: RoastState,
  readings: readonly Reading[],
  tempShort: string = DEFAULT_TEMP_NAMES.short,
): Omit<RoastStripProps, 'onOpen' | 'className'> | undefined {
  const coolingRoaster = roast.roasterCoolToC !== null;
  if (!RUNNING.includes(roast.phase) && !coolingRoaster) return undefined;
  const n = roastNumbers(roast, readings);
  const latest = readings.at(-1)?.values;
  const bt = formatNumber(n.bt, 1);
  const temp = { label: tempShort, value: bt === undefined ? undefined : `${bt} °C` };
  const fan = { label: 'Fan', value: percent(latest?.fan) };
  const numbers = [
    temp,
    { label: 'RoR', value: formatNumber(n.ror, 1) },
    { label: 'Heater', value: percent(latest?.heater) },
    fan,
  ];
  if (coolingRoaster)
    return {
      lead: `Cooling the roaster · ${formatNumber(n.bt, 0) ?? '–'} °C → ${String(roast.roasterCoolToC)} °C`,
      numbers: [temp, fan],
    };
  if (roast.phase === 'cooling') {
    const left =
      roast.coolingBelowC === null
        ? `Cooling ${clock(n.coolingLeftS)} left`
        : `Cooling · ${formatNumber(n.bt, 0) ?? '–'} °C → ${String(roast.coolingBelowC)} °C`;
    const nowMs = readings.at(-1)?.atMs;
    const justDropped =
      roast.droppedAtMs !== null &&
      nowMs !== undefined &&
      nowMs - roast.droppedAtMs < DUMP_PROMPT_MS;
    return {
      lead: left,
      prompt: justDropped ? `Dump beans · ${left}` : undefined,
      numbers: [temp],
    };
  }
  const time = roast.phase === 'preheat' ? n.preheatS : n.elapsedS;
  return { lead: `${PHASE_LABEL[roast.phase]} · ${clock(time)}`, numbers };
}
