import {
  Coach,
  autoSettingRule,
  dropSoonRule,
  firstCrackSoonRule,
  withSoakTime,
  type Clock,
  type CoachRule,
  type Logger,
  type ManualRoast,
  type RoasterSession,
} from '@roastpilot/core';
import {
  IPC_CHANNELS,
  type IpcEventChannel,
  type IpcEventPayloads,
  type Reading,
  type RoastState,
} from '@roastpilot/shared';
import { autoProfile, heaterLocked, roundOutput } from './auto-wiring';
import { FirstCrackExpectation } from './first-crack-expectation';
import type { HistoryService } from './history/history-service';
import type { ProfileService } from './profiles/profile-service';
import type { RoasterService } from './roasters/roaster-service';
import type { SettingsService } from './settings/settings-service';

/** The coach's rules, in order (docs/spec/extensibility.md, Manual coach): new tips go here. */
const COACH_RULES: readonly CoachRule[] = [autoSettingRule, firstCrackSoonRule, dropSoonRule];

/** The coach, and what it hears of each roast change. */
export interface Coaching {
  coach: Coach;
  /** At charge it reads the expected first crack; any change may end the card at once. */
  onRoastChange: (state: RoastState) => void;
}

/** The coach on the app's own session, flow and settings (docs/spec/manual-mode.md, Coach). */
export function createCoach({
  clock,
  session,
  roast,
  settings,
  profiles,
  roasters,
  readings,
  history,
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
  history: Pick<HistoryService, 'list'>;
  publish: <C extends IpcEventChannel>(channel: C, payload: IpcEventPayloads[C]) => void;
  logger: Logger;
}): Coaching {
  const coachLogger = logger.child('coach');
  const firstCrack = new FirstCrackExpectation({
    list: () => history.list(),
    roasterId: () => roasters.active().id,
    logger: coachLogger,
  });
  let chargeSeen: number | null = null;
  const coach = new Coach({
    clock,
    roast: () => roast.state,
    readings,
    // The profile picked for Auto, as Auto would run it (ADR 0019).
    profile: () => withSoakTime(autoProfile(profiles, roasters), settings.latest.soakTimeS),
    tuning: () => roasters.active().tuning,
    wanted: () => settings.latest.roastMode === 'manual' && settings.latest.coachInManual,
    heaterLocked: heaterLocked(session),
    expectedFirstCrackC: () => firstCrack.expectedC,
    round: roundOutput(session),
    rules: COACH_RULES,
    onChange: (status) => {
      publish(IPC_CHANNELS.coachStatus, status);
    },
    logger: coachLogger,
  });
  return {
    coach,
    onRoastChange: (state) => {
      // From the roasts saved before this one.
      if (state.chargedAtMs !== null && state.chargedAtMs !== chargeSeen) {
        chargeSeen = state.chargedAtMs;
        firstCrack.refresh();
      }
      coach.sync();
    },
  };
}
