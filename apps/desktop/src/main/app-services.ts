import {
  ManualRoast,
  ReadingHistory,
  RoasterSession,
  type Clock,
  type Logger,
  type SettingsStore,
} from '@roastpilot/core';
import {
  IPC_CHANNELS,
  type IpcEventChannel,
  type IpcEventPayloads,
  type Snapshot,
} from '@roastpilot/shared';
import { SettingsService } from './settings/settings-service';

export interface AppServicesDeps {
  clock: Clock;
  logger: Logger;
  settingsStore: SettingsStore;
  /** Sends an event to every window. */
  publish: <C extends IpcEventChannel>(channel: C, payload: IpcEventPayloads[C]) => void;
}

export interface AppServices {
  session: RoasterSession;
  roast: ManualRoast;
  settings: SettingsService;
  snapshot: () => Snapshot;
}

/** Everything main runs, wired together without Electron, so it can be tested on fake time. */
export function createAppServices({
  clock,
  logger,
  settingsStore,
  publish,
}: AppServicesDeps): AppServices {
  const history = new ReadingHistory();
  const session = new RoasterSession({
    clock,
    logger: logger.child('session'),
    onReading: (reading) => {
      history.add(reading);
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
  return { session, roast, settings: new SettingsService(settingsStore), snapshot };
}
