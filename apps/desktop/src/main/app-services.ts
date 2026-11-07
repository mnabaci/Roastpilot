import {
  DEFAULT_SAFETY_LIMITS,
  ReadingHistory,
  RoasterSession,
  RoastRecorder,
  serializeError,
  type Clock,
  type Logger,
  type ManualRoast,
  type BeanRepository,
  type ProfileRepository,
  type RoasterRepository,
  type RoastRepository,
  type SettingsStore,
} from '@roastpilot/core';
import {
  IPC_CHANNELS,
  type ConnectionState,
  type RoastState,
  type IpcEventChannel,
  type IpcEventPayloads,
  type Snapshot,
} from '@roastpilot/shared';
import { autoProfile, createAutoPilot, roastPlan } from './auto-wiring';
import { BeanService } from './beans/bean-service';
import { createHistory } from './history-wiring';
import type { HistoryService } from './history/history-service';
import type { RoastFileService } from './history/roast-file-service';
import { ProfileService } from './profiles/profile-service';
import { RoasterService } from './roasters/roaster-service';
import { createManualRoast } from './roast-wiring';
import { sessionHandlers } from './session-handlers';
import { startLoading } from './start-loading';
import { SettingsService } from './settings/settings-service';

export interface AppServicesDeps {
  clock: Clock;
  logger: Logger;
  settingsStore: SettingsStore;
  roasts: RoastRepository;
  profileStore: ProfileRepository;
  roasterStore: RoasterRepository;
  beanStore: BeanRepository;
  /** New ids for your own profiles. */
  newProfileId: () => string;
  /** Wall-clock time as ISO 8601, for saved roasts. */
  nowIso: () => string;
  /** Every connection change, besides the windows (the power guard). */
  onConnectionChange: (state: ConnectionState) => void;
  /** Every roast change, besides the windows (the power guard). */
  onRoastChange?: (state: RoastState) => void;
  /** Sends an event to every window. */
  publish: <C extends IpcEventChannel>(channel: C, payload: IpcEventPayloads[C]) => void;
}

export interface AppServices {
  session: RoasterSession;
  roast: ManualRoast;
  settings: SettingsService;
  history: HistoryService;
  roastFiles: RoastFileService;
  recorder: RoastRecorder;
  pilot: ReturnType<typeof createAutoPilot>;
  profiles: ProfileService;
  roasters: RoasterService;
  beans: BeanService;
  snapshot: () => Snapshot;
}

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
  publish,
}: AppServicesDeps): AppServices {
  const history = new ReadingHistory();
  const beans = new BeanService({
    repository: beanStore,
    onChange: (list) => {
      publish(IPC_CHANNELS.beansChanged, list);
    },
    logger: logger.child('beans'),
  });
  // A roast takes its batch off green stock, and its result adds to roasted stock.
  const refreshBeans = () => {
    beans.refresh().catch((error: unknown) => {
      logger.error('beans.refresh-failed', { error: serializeError(error) });
    });
  };
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
  const session: RoasterSession = new RoasterSession({
    clock,
    logger: logger.child('session'),
    limits: () => {
      const { maxTempC, maxTimeS } = roasters.active();
      return { ...DEFAULT_SAFETY_LIMITS, maxTempC, maxRoastMs: maxTimeS * 1000 };
    },
    tempOffsetC: () => roasters.active().tempOffsetC,
    ...sessionHandlers({
      history,
      recorder,
      parts: () => ({ roast, pilot }),
      publish,
      onConnectionChange,
      logger: roastLogger,
    }),
  });
  const settings = new SettingsService(settingsStore, (latest) => {
    pilot.setEnabled(latest.roastMode === 'auto');
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
  const roast = createManualRoast({
    clock,
    logger: roastLogger,
    session,
    history,
    settings,
    roasters,
    onChange: (state) => {
      recorder.onRoastChange(state);
      onRoastChange(state);
      publish(IPC_CHANNELS.roast, state);
    },
  });
  const pilot = createAutoPilot({
    session,
    roast,
    settings,
    profiles,
    roasters,
    readings: () => history.all(),
    publish,
    logger,
  });
  const snapshot = (): Snapshot => ({
    connection: session.connection,
    roast: roast.state,
    readings: [...history.all()],
    safety: session.safetyStatus,
    auto: pilot.status,
    setup: beans.setup,
    currentRoastId: recorder.currentId,
  });
  return {
    session,
    roast,
    settings,
    ...createHistory({
      roasts,
      beans,
      roasters,
      recorder,
      nowIso,
      refreshBeans,
      publish,
      logger: historyLogger,
    }),
    recorder,
    pilot,
    profiles,
    roasters,
    beans,
    snapshot,
  };
}
