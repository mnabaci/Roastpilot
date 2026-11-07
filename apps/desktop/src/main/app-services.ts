import { ReadingHistory, RoastRecorder, type RoasterSession } from '@roastpilot/core';
import { IPC_CHANNELS, type Snapshot } from '@roastpilot/shared';
import type { AppServices, AppServicesDeps } from './app-services-types';
import { autoProfile, roastPlan } from './auto-wiring';
import { createBeans } from './bean-wiring';
import { createRoastControl } from './control-wiring';
import { createHistory } from './history-wiring';
import { ProfileService } from './profiles/profile-service';
import { RoasterService } from './roasters/roaster-service';
import { createManualRoast } from './roast-wiring';
import { createSession } from './session-wiring';
import { startLoading } from './start-loading';
import { SettingsService } from './settings/settings-service';

export type { AppServices, AppServicesDeps } from './app-services-types';

/** Everything main runs, wired together without Electron, so it can be tested on fake time. */
export function createAppServices({
  clock,
  logger,
  settingsStore,
  roasts,
  profileStore,
  roasterStore,
  beanStore,
  newProfileId,
  nowIso,
  onConnectionChange,
  onRoastChange = () => undefined,
  onSettingsChange = () => undefined,
  publish,
}: AppServicesDeps): AppServices {
  const history = new ReadingHistory();
  const { beans, refreshBeans } = createBeans({ repository: beanStore, publish, logger });
  const historyLogger = logger.child('history');
  const roastLogger = logger.child('roast');
  const recorder = new RoastRecorder({
    repository: roasts,
    nowIso,
    readingsSoFar: () => history.all(),
    plan: () =>
      roastPlan(settings, () => autoProfile(profiles, roasters), roasters.active().id, beans.setup),
    onSaved: (id) => {
      publish(IPC_CHANNELS.roastsChanged, { id, deleted: false, current: true });
      refreshBeans();
    },
    logger: historyLogger,
  });
  const roasters: RoasterService = new RoasterService({
    repository: roasterStore,
    inUse: () => session.connection.status !== 'disconnected',
    onChange: (list) => {
      publish(IPC_CHANNELS.roastersChanged, list);
    },
    logger: logger.child('roasters'),
  });
  const session: RoasterSession = createSession({
    clock,
    logger,
    roasters,
    handlers: {
      history,
      recorder,
      parts: () => ({ roast, pilot, coach }),
      publish,
      onConnectionChange,
      logger: roastLogger,
    },
  });
  const settings = new SettingsService(settingsStore, (latest) => {
    pilot.setEnabled(latest.roastMode === 'auto');
    coach.sync();
    onSettingsChange(latest);
  });
  const profiles = new ProfileService({
    store: profileStore,
    newId: newProfileId,
    chosenId: () => settings.latest.autoProfile,
    activeRoaster: () => roasters.active(),
    logger: logger.child('profiles'),
  });
  // Before the first roast, so a chosen profile of your own is there without opening a window.
  startLoading({ settings, roasters, profiles, logger });
  const saved = createHistory({
    roasts,
    beans,
    roasters,
    recorder,
    nowIso,
    refreshBeans,
    publish,
    logger: historyLogger,
  });
  const roast = createManualRoast({
    clock,
    logger: roastLogger,
    session,
    history,
    settings,
    roasters,
    onChange: (state) => {
      recorder.onRoastChange(state);
      coaching.onRoastChange(state);
      onRoastChange(state);
      publish(IPC_CHANNELS.roast, state);
    },
  });
  const { pilot, coaching, setOutputByHand, coachActions } = createRoastControl({
    clock,
    session,
    roast,
    settings,
    profiles,
    roasters,
    readings: () => history.all(),
    savedRoasts: saved.history,
    publish,
    logger,
  });
  const { coach } = coaching;
  const snapshot = (): Snapshot => ({
    connection: session.connection,
    roast: roast.state,
    readings: [...history.all()],
    safety: session.safetyStatus,
    auto: pilot.status,
    coach: coach.status,
    setup: beans.setup,
    currentRoastId: recorder.currentId,
  });
  return {
    session,
    roast,
    settings,
    ...saved,
    recorder,
    pilot,
    coach,
    coachActions,
    setOutputByHand,
    profiles,
    roasters,
    beans,
    snapshot,
  };
}
