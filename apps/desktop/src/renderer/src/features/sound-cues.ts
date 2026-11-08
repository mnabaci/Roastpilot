import type { AutoStatus, AutoStopReason, RoastState, SoundStep } from '@roastpilot/shared';
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

/** What tells whether a step still needs you, after it played. */
export interface WaitState {
  roast: Pick<RoastState, 'phase' | 'firstCrackAtMs'>;
  auto: Pick<AutoStatus, 'enabled' | 'preheatStep' | 'stopReason'>;
}

/** Whether a step still needs you, so its repeats go on (docs/spec/ui.md, Sounds). */
export function stillWaiting(step: SoundStep, { roast, auto }: WaitState): boolean {
  switch (step) {
    case 'charge-soon':
      return auto.enabled && auto.preheatStep === 'add-beans';
    case 'beans-in':
      return auto.enabled && auto.preheatStep === 'beans-in';
    case 'listen-first-crack':
      return roast.phase === 'roasting' && roast.firstCrackAtMs === null;
    case 'dump-beans':
      return roast.phase === 'cooling';
    case 'auto-stopped':
      return auto.enabled && auto.stopReason !== null;
  }
}

/** The listen cue sounds this far under the expected first-crack temperature, in °C. */
export const LISTEN_BEFORE_C = 3;

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
