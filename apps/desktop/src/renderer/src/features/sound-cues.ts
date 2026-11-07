import type {
  AutoStatus,
  AutoStopReason,
  RoastState,
  RoastSummary,
  SoundStep,
} from '@roastpilot/shared';
import { isAutoDriven } from '../lib/roast-phases';

/** What the step sounds compare, before and after a change. */
export interface CueState {
  roast: Pick<RoastState, 'phase'>;
  auto: Pick<AutoStatus, 'enabled' | 'preheatStep' | 'stopReason'>;
}

/** Stops a safety trip caused: their banners speak for them, so no sound. */
const SAFETY_STOPS: readonly AutoStopReason[] = ['safety-stop', 'heater-locked'];

/** The steps a change has just reached (docs/spec/ui.md, Sounds); none when nothing new needs you. */
export function stepsReached(before: CueState, after: CueState): SoundStep[] {
  const steps: SoundStep[] = [];
  const preheat = after.auto.enabled ? after.auto.preheatStep : null;
  const reached = preheat !== null && before.auto.preheatStep !== preheat;
  if (reached && preheat === 'add-beans') steps.push('charge-soon');
  if (reached && preheat === 'beans-in') steps.push('beans-in');
  if (after.roast.phase === 'cooling' && before.roast.phase !== 'cooling') steps.push('dump-beans');
  const reason = after.auto.stopReason;
  if (
    after.auto.enabled &&
    before.auto.stopReason === null &&
    reason !== null &&
    isAutoDriven(after.roast.phase) &&
    !SAFETY_STOPS.includes(reason)
  )
    steps.push('auto-stopped');
  return steps;
}

/** How many recent roasts with a first crack set the expected temperature. */
const RECENT = 5;
/** The listen cue sounds this far under the expected first-crack temperature, in °C. */
export const LISTEN_BEFORE_C = 3;

/** The middle value, or the mean of the two middle ones; undefined for none. */
function median(values: readonly number[]): number | undefined {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid];
  const lower = sorted[mid - 1];
  if (upper === undefined) return undefined;
  return sorted.length % 2 === 1 || lower === undefined ? upper : (lower + upper) / 2;
}

/**
 * BT at first crack to expect: the median of the last 5 saved roasts that had one, from this
 * roaster when it has any, otherwise from all. Undefined without any.
 */
export function expectedFirstCrackC(
  roasts: readonly RoastSummary[],
  roasterId: number | undefined,
): number | undefined {
  const cracked = roasts.filter((r) => r.fcTemp !== null);
  const own = cracked.filter((r) => r.roasterId === roasterId);
  const newestFirst = [...(own.length > 0 ? own : cracked)].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );
  return median(newestFirst.slice(0, RECENT).flatMap((r) => (r.fcTemp === null ? [] : [r.fcTemp])));
}

/** Time to listen for first crack: charged, no crack yet, and BT within 3 °C of the expected. */
export function listenDue(
  roast: Pick<RoastState, 'phase' | 'firstCrackAtMs'>,
  bt: number | undefined,
  expectedC: number | undefined,
): boolean {
  if (roast.phase !== 'roasting' || roast.firstCrackAtMs !== null) return false;
  if (bt === undefined || expectedC === undefined) return false;
  return bt >= expectedC - LISTEN_BEFORE_C;
}
