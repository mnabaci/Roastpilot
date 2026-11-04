import {
  ManualRoast,
  ReadingHistory,
  RoasterSession,
  RoastRecorder,
  serializeError,
  type Clock,
  type Logger,
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
import { HistoryService } from './history/history-service';
import { SettingsService } from './settings/settings-service';

export interface AppServicesDeps {
  clock: Clock;
  logger: Logger;
  settingsStore: SettingsStore;
  roasts: RoastRepository;
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
  onConnectionChange,
  onRoastChange = () => undefined,
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
      // After it is kept: the turning point and the roaster cool-down look at the readings.
      roast.onReading(reading).catch((error: unknown) => {
        roastLogger.error('roast.reading-failed', { error: serializeError(error) });
      });
    },
    onConnection: (state) => {
      onConnectionChange(state);
      publish(IPC_CHANNELS.connection, state);
      // A fresh connection starts with the outputs off: a running roast puts its own back.
      if (state.status === 'connected') {
        roast.restoreOutputs().catch((error: unknown) => {
          roastLogger.error('roast.restore-failed', { error: serializeError(error) });
        });
      } else if (state.status === 'disconnected') roast.stopRoasterCooling('disconnected');
    },
    onSafetyEvent: (event) => {
      publish(IPC_CHANNELS.safetyEvent, event);
      if (event.kind === 'tripped' && event.action === 'safe-stop')
        roast.stopRoasterCooling('safety-stop');
    },
  });
  const roastLogger = logger.child('roast');
  const settings = new SettingsService(settingsStore);
  settings.get().catch((error: unknown) => {
    logger.error('settings.load-failed', { error: serializeError(error) });
  });
  const roast = new ManualRoast({
    clock,
    logger: roastLogger,
    setOutput: (channel, value) => session.setOutput(channel, value),
    latestBt: () => history.latest()?.values.bt,
    readings: () => history.all(),
    canCoolRoaster: () => session.connection.status === 'connected' && !session.safetyStatus.locked,
    options: () => {
      const latest = settings.latest;
      return {
        findChargePoint: latest.findChargePoint,
        coolingMs: latest.coolingTimeMin * 60_000,
        coolingBelowC: latest.coolingEnd === 'temperature' ? latest.coolingBelowC : null,
        coolRoasterAfter: latest.coolRoasterAfter,
        roasterCoolToC: latest.roasterCoolToC,
      };
    },
    onChange: (state) => {
      recorder.onRoastChange(state);
      onRoastChange(state);
      publish(IPC_CHANNELS.roast, state);
    },
    onNewRoast: () => {
      history.clear();
    },
    onRoastStarted: (chargedAtMs) => {
      session.roastStarted(chargedAtMs);
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
    settings,
    history: new HistoryService({
      repository: roasts,
      isRecording: (id) => recorder.isRecording(id),
      onDeleted: (id) => {
        publish(IPC_CHANNELS.roastsChanged, { id });
      },
      logger: historyLogger,
    }),
    recorder,
    snapshot,
  };
}
