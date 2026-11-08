import type { Coach, Logger, ManualRoast } from '@roastpilot/core';
import {
  coachAppliedDetail,
  CoachOutputSchema,
  err,
  ok,
  type CoachApplyError,
  type CoachChange,
  type CoachOutput,
  type Result,
} from '@roastpilot/shared';
import type { HandOutput } from './hand-output';

/** Apply and Dismiss on the coach card (docs/spec/manual-mode.md, Coach). */
export interface CoachActions {
  apply: (id: number) => Promise<Result<void, CoachApplyError>>;
  dismiss: (id: number) => void;
}

/**
 * Apply sets the card's outputs through the sliders' path, heater first, and records a
 * `coach-applied` event with what changed. A refused output stops there: what was set is recorded.
 * A roast that stops allowing it while an output is being set (Drop, Auto, a lock) gets no more.
 */
export function coachActions({
  coach,
  setOutput,
  roast,
  logger,
}: {
  coach: Pick<Coach, 'claim' | 'canApply' | 'dismiss'>;
  setOutput: HandOutput;
  roast: Pick<ManualRoast, 'note'>;
  logger: Logger;
}): CoachActions {
  return {
    apply: async (id) => {
      const claimed = coach.claim(id);
      if (!claimed.ok) {
        logger.info('coach.apply-refused', { id, ...claimed.error });
        return claimed;
      }
      const changed: Partial<Record<CoachOutput, CoachChange>> = {};
      let refused: CoachApplyError | undefined;
      for (const output of CoachOutputSchema.options) {
        const change = claimed.value[output];
        if (!change || refused) continue;
        // After an earlier output's await: Drop may have set the cooling fan, which Apply must keep.
        if (Object.keys(changed).length > 0 && !coach.canApply()) {
          refused = { kind: 'not-now' };
          continue;
        }
        const sent = await setOutput(output, change.to);
        if (sent.ok) changed[output] = change;
        else refused = sent.error;
      }
      if (Object.keys(changed).length > 0) {
        roast.note('coach-applied', coachAppliedDetail(changed));
        logger.info('coach.applied', { id, ...changed });
      }
      if (refused) {
        logger.warn('coach.apply-failed', { id, error: refused });
        return err(refused);
      }
      return ok(undefined);
    },
    dismiss: (id) => {
      coach.dismiss(id);
    },
  };
}
