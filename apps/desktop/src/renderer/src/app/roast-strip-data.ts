import {
  DEFAULT_TEMP_NAMES,
  type AutoStatus,
  type Reading,
  type RoastPhase,
  type RoastState,
} from '@roastpilot/shared';
import { formatClock, formatNumber, type RoastStripProps } from '@roastpilot/ui';
import { STOP_REASON } from '../screens/roast/auto-flow';
import { roastNumbers } from '../screens/roast/roast-numbers';
import { isAutoDriven } from '../lib/roast-phases';
import { PHASE_LABEL } from './phase-label';

/** Dump beans leads the strip for the first minute of cooling: the one prompt that can't wait. */
export const DUMP_PROMPT_MS = 60_000;

const RUNNING: readonly RoastPhase[] = ['preheat', 'roasting', 'development', 'cooling'];

const clock = (s: number | undefined) => (s === undefined ? '–' : formatClock(s));
const percent = (v: number | undefined) => (v === undefined ? undefined : `${String(v)} %`);

/** Auto's steps that wait for you lead the strip, like Dump beans: the hold's limit is running. */
function autoPrompt(phase: RoastPhase, auto: AutoStatus | undefined): string | undefined {
  if (!auto?.enabled || !isAutoDriven(phase)) return undefined;
  if (auto.stopReason !== null) return `${STOP_REASON[auto.stopReason]} · Auto stopped`;
  if (phase !== 'preheat') return undefined;
  switch (auto.preheatStep) {
    case 'add-beans':
      return 'Add beans · then Charge soon';
    case 'charge-cut':
      return `Heater off · beans in ${clock(auto.preheatLeftS ?? undefined)}`;
    case 'beans-in':
      return 'Beans in now · press Start';
    default:
      return undefined;
  }
}

/**
 * What the roast strip shows on the other screens (docs/spec/ui.md, Roast strip), or undefined
 * when no roast is running and the drum isn't cooling.
 */
export function roastStripData(
  roast: RoastState,
  readings: readonly Reading[],
  tempShort: string = DEFAULT_TEMP_NAMES.short,
  auto?: AutoStatus,
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
  // While the beans cool, their countdown leads, even with the drum cooling beside them.
  if (roast.phase === 'cooling') {
    const left = `Cooling beans ${clock(n.coolingLeftS)} left`;
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
  if (coolingRoaster)
    return {
      lead: `Cooling the drum · ${formatNumber(n.bt, 0) ?? '–'} °C → ${String(roast.roasterCoolToC)} °C`,
      numbers: [temp, fan],
    };
  const time = roast.phase === 'preheat' ? n.preheatS : n.elapsedS;
  return {
    lead: `${PHASE_LABEL[roast.phase]} · ${clock(time)}`,
    prompt: autoPrompt(roast.phase, auto),
    numbers,
  };
}
