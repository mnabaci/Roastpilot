import type {
  AutoPilot,
  Clock,
  Logger,
  ManualRoast,
  PreheatHold,
  RoasterSession,
} from '@roastpilot/core';
import type { IpcEventChannel, IpcEventPayloads, Reading } from '@roastpilot/shared';
import { createAutoPilot } from './auto-wiring';
import { coachActions, type CoachActions } from './coach-apply';
import { createCoach, type Coaching } from './coach-wiring';
import { handOutput, type HandOutput } from './hand-output';
import type { HistoryService } from './history/history-service';
import type { ProfileService } from './profiles/profile-service';
import type { RoasterService } from './roasters/roaster-service';
import type { SettingsService } from './settings/settings-service';

/** Who drives the outputs during a roast besides the flow: Auto, the coach, and your hand. */
export interface RoastControl {
  pilot: AutoPilot;
  coaching: Coaching;
  /** The sliders' path to the roaster, which the coach's Apply takes too. */
  setOutputByHand: HandOutput;
  coachActions: CoachActions;
}

/** Auto and the coach on the roast flow, and the one hand path both hear of (ADR 0019). */
export function createRoastControl({
  clock,
  session,
  roast,
  settings,
  profiles,
  roasters,
  readings,
  savedRoasts,
  preheatHold,
  publish,
  logger,
}: {
  clock: Clock;
  session: RoasterSession;
  roast: ManualRoast;
  settings: Pick<SettingsService, 'latest'>;
  profiles: Pick<ProfileService, 'active'>;
  roasters: Pick<RoasterService, 'active'>;
  readings: () => readonly Reading[];
  /** The saved roasts, for the coach's expected first crack. */
  savedRoasts: Pick<HistoryService, 'list'>;
  /** The hold a preheat starting now runs (PreheatHoldPicker). */
  preheatHold: () => PreheatHold;
  publish: <C extends IpcEventChannel>(channel: C, payload: IpcEventPayloads[C]) => void;
  logger: Logger;
}): RoastControl {
  const shared = { session, roast, settings, profiles, roasters, readings, publish, logger };
  const pilot = createAutoPilot({ ...shared, preheatHold });
  const coaching = createCoach({ ...shared, clock, history: savedRoasts });
  const { coach } = coaching;
  const setOutputByHand = handOutput({ session, roast, pilot, coach });
  return {
    pilot,
    coaching,
    setOutputByHand,
    coachActions: coachActions({
      coach,
      setOutput: setOutputByHand,
      roast,
      logger: logger.child('coach'),
    }),
  };
}
