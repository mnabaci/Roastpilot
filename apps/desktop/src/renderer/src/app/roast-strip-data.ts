import { ROASTER_COOL_C } from '@roastpilot/core';
import type { Reading, RoastPhase, RoastState } from '@roastpilot/shared';
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
): Omit<RoastStripProps, 'onOpen' | 'className'> | undefined {
  const coolingRoaster = roast.roasterCoolingSinceMs !== null;
  if (!RUNNING.includes(roast.phase) && !coolingRoaster) return undefined;
  const n = roastNumbers(roast, readings);
  const latest = readings.at(-1)?.values;
  const bt = formatNumber(n.bt, 1);
  const numbers = [
    { label: 'BT', value: bt === undefined ? undefined : `${bt} °C` },
    { label: 'RoR', value: formatNumber(n.ror, 1) },
    { label: 'Heater', value: percent(latest?.heater) },
    { label: 'Fan', value: percent(latest?.fan) },
  ];
  if (coolingRoaster)
    return {
      lead: `Cooling the roaster · ${formatNumber(n.bt, 0) ?? '–'} °C → ${String(ROASTER_COOL_C)} °C`,
      numbers: numbers.filter((x) => x.label === 'BT' || x.label === 'Fan'),
    };
  if (roast.phase === 'cooling') {
    const left = `Cooling ${clock(n.coolingLeftS)} left`;
    const nowMs = readings.at(-1)?.atMs;
    const justDropped =
      roast.droppedAtMs !== null &&
      nowMs !== undefined &&
      nowMs - roast.droppedAtMs < DUMP_PROMPT_MS;
    return {
      lead: left,
      prompt: justDropped ? `Dump beans · ${left}` : undefined,
      numbers: numbers.filter((x) => x.label === 'BT'),
    };
  }
  const time = roast.phase === 'preheat' ? n.preheatS : n.elapsedS;
  return { lead: `${PHASE_LABEL[roast.phase]} · ${clock(time)}`, numbers };
}
