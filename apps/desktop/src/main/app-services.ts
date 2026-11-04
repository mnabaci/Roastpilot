import {
  ManualRoast,
  ReadingHistory,
  RoasterSession,
  RoastRecorder,
  type Clock,
  type Logger,
  type RoastRepository,
  type SettingsStore,
} from '@roastpilot/core';
import {
  IPC_CHANNELS,
  type IpcEventChannel,
  type IpcEventPayloads,
  type Snapshot,
} from '@roastpilot/shared';
import { HistoryService } from './history/history-service';
import { SettingsService } from './settings/settings-service';

export interface AppServicesDeps {
  clock: Clock;
  logger: Logger;
  settingsStore: SettingsStore;
  roasts: RoastRepository;
  /** Wall-clock time as ISO 8601, for saved roasts. */
  nowIso: () => string;
  /** Sends an event to every window. */
  publish: <C extends IpcEventChannel>(channel: C, payload: IpcEventPayloads[C]) => void;
}

export interface AppServices {
  session: RoasterSession;
  roast: ManualRoast;
  settings: SettingsService;
  history: HistoryService;
  recorder: RoastRecorder;
  snapshot: () => Snapshot;
}

/** Everything main runs, wired together without Electron, so it can be tested on fake time. */
export function createAppServices({
  clock,
  logger,
  settingsStore,
  roasts,
  nowIso,
  publish,
}: AppServicesDeps): AppServices {
  const history = new ReadingHistory();
  const historyLogger = logger.child('history');
  const recorder = new RoastRecorder({
    repository: roasts,
    nowIso,
    readingsSoFar: () => history.all(),
    onSaved: (id) => {
      publish(IPC_CHANNELS.roastsChanged, { id });
    },
    logger: historyLogger,
  });
  const session = new RoasterSession({
    clock,
    logger: logger.child('session'),
    onReading: (reading) => {
      history.add(reading);
      recorder.onReading(reading);
      publish(IPC_CHANNELS.reading, reading);
    },
    onConnection: (state) => {
      publish(IPC_CHANNELS.connection, state);
    },
    onSafetyEvent: (event) => {
      publish(IPC_CHANNELS.safetyEvent, event);
    },
  });
  const roast = new ManualRoast({
    clock,
    logger: logger.child('roast'),
    setOutput: (channel, value) => session.setOutput(channel, value),
    latestBt: () => history.latest()?.values.bt,
    onChange: (state) => {
      recorder.onRoastChange(state);
      publish(IPC_CHANNELS.roast, state);
    },
    onNewRoast: () => {
      history.clear();
    },
    onRoastStarted: () => {
      session.roastStarted();
    },
    onRoastEnded: () => {
      session.roastEnded();
    },
  });
  const snapshot = (): Snapshot => ({
    connection: session.connection,
    roast: roast.state,
    readings: [...history.all()],
    safety: session.safetyStatus,
  });
  return {
    session,
    roast,
    settings: new SettingsService(settingsStore),
    history: new HistoryService({
      repository: roasts,
      onDeleted: (id) => {
        publish(IPC_CHANNELS.roastsChanged, { id });
      },
      logger: historyLogger,
    }),
    recorder,
    snapshot,
  };
}
