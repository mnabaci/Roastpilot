import {
  AutoPilot,
  ManualRoast,
  ReadingHistory,
  RoasterSession,
  quantize,
  RoastRecorder,
  serializeError,
  withSoakTime,
  type Clock,
  type AutoEvent,
  type Logger,
  type ProfileRepository,
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
import { SKYWALKER_TUNING } from '@roastpilot/drivers';
import { HistoryService } from './history/history-service';
import { ProfileService } from './profiles/profile-service';
import { SettingsService } from './settings/settings-service';

export interface AppServicesDeps {
  clock: Clock;
  logger: Logger;
  settingsStore: SettingsStore;
  roasts: RoastRepository;
  profileStore: ProfileRepository;
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
  recorder: RoastRecorder;
  pilot: AutoPilot;
  profiles: ProfileService;
  snapshot: () => Snapshot;
}

function noteAutoEvent(roast: ManualRoast, event: AutoEvent): void {
  switch (event.kind) {
    case 'phase':
      roast.note('phase', event.name);
      return;
    case 'dry-end':
      roast.note('dry-end');
      return;
    case 'stall-guard':
      roast.note('stall-guard', event.tripped ? 'tripped' : 'cleared');
      return;
    case 'override':
      roast.note('override', `${event.channel} ${String(event.value)}`);
  }
}

/** Everything main runs, wired together without Electron, so it can be tested on fake time. */
export function createAppServices({
  clock,
  logger,
  settingsStore,
  roasts,
  profileStore,
  newProfileId,
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
    plan: () =>
      settings.latest.roastMode === 'auto'
        ? { mode: 'auto', profile: withSoakTime(profiles.active(), settings.latest.soakTimeS) }
        : { mode: 'manual', profile: null },
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
      pilot.onReading(reading).catch((error: unknown) => {
        roastLogger.error('auto.reading-failed', { error: serializeError(error) });
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
      if (state.status === 'disconnected' || state.status === 'lost') pilot.stop(state.status);
    },
    onSafetyEvent: (event) => {
      publish(IPC_CHANNELS.safetyEvent, event);
      if (event.kind === 'tripped' && event.action === 'safe-stop') {
        roast.stopRoasterCooling('safety-stop');
        pilot.stop('safety-stop');
      }
    },
  });
  const roastLogger = logger.child('roast');
  const settings = new SettingsService(settingsStore, (latest) => {
    pilot.setEnabled(latest.roastMode === 'auto');
  });
  const profiles = new ProfileService({
    store: profileStore,
    newId: newProfileId,
    chosenId: () => settings.latest.autoProfile,
    logger: logger.child('profiles'),
  });
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
    onTurningPoint: (atMs) => {
      session.turningPoint(atMs);
    },
    onRoastEnded: () => {
      session.roastEnded();
    },
  });
  const pilot = new AutoPilot({
    roast: () => roast.state,
    readings: () => history.all(),
    setOutput: (channel, value) => session.setOutput(channel, value),
    round: (channel, value) => {
      const { connection } = session;
      const output =
        connection.status === 'connected'
          ? connection.channels.find((c) => c.id === channel)
          : undefined;
      return output?.kind === 'output' ? quantize(output, value) : value;
    },
    heaterLocked: () => session.connection.status !== 'connected' || session.safetyStatus.locked,
    drop: async () => {
      const dropped = await roast.act('drop');
      if (!dropped.ok) roastLogger.warn('auto.drop-refused', { error: dropped.error });
    },
    profile: () => profiles.active(),
    tuning: () => SKYWALKER_TUNING,
    soakS: () => settings.latest.soakTimeS,
    onEvent: (event) => {
      // Only a roast has a timeline to put it on: preheat overrides stay in the log.
      if (roast.state.chargedAtMs !== null) noteAutoEvent(roast, event);
    },
    onChange: (status) => {
      publish(IPC_CHANNELS.autoStatus, status);
    },
    logger: logger.child('auto'),
  });
  const snapshot = (): Snapshot => ({
    connection: session.connection,
    roast: roast.state,
    readings: [...history.all()],
    safety: session.safetyStatus,
    auto: pilot.status,
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
    pilot,
    profiles,
    snapshot,
  };
}
