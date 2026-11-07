import {
  serializeError,
  type AutoPilot,
  type Coach,
  type Logger,
  type ManualRoast,
  type ReadingHistory,
  type RoastRecorder,
} from '@roastpilot/core';
import {
  IPC_CHANNELS,
  type ConnectionState,
  type IpcEventChannel,
  type IpcEventPayloads,
  type Reading,
  type SafetyEvent,
} from '@roastpilot/shared';

/**
 * What the roaster session tells the rest of main: each reading, connection change and safety
 * event, passed to the windows, the roast flow, Auto, the coach and the recorder. `parts` is read late: the
 * roast and Auto are made after the session.
 */
export function sessionHandlers({
  history,
  recorder,
  parts,
  publish,
  onConnectionChange,
  logger,
}: {
  history: ReadingHistory;
  recorder: Pick<RoastRecorder, 'onReading'>;
  parts: () => { roast: ManualRoast; pilot: AutoPilot; coach: Coach };
  publish: <C extends IpcEventChannel>(channel: C, payload: IpcEventPayloads[C]) => void;
  onConnectionChange: (state: ConnectionState) => void;
  logger: Logger;
}) {
  return {
    onReading: (reading: Reading) => {
      const { roast, pilot, coach } = parts();
      history.add(reading);
      recorder.onReading(reading);
      publish(IPC_CHANNELS.reading, reading);
      // After it is kept: the turning point and drum cooling look at the readings.
      roast.onReading(reading).catch((error: unknown) => {
        logger.error('roast.reading-failed', { error: serializeError(error) });
      });
      pilot.onReading(reading).catch((error: unknown) => {
        logger.error('auto.reading-failed', { error: serializeError(error) });
      });
      // It never sends anything, and logs its own failures.
      coach.onReading(reading);
    },
    onConnection: (state: ConnectionState) => {
      const { roast, pilot, coach } = parts();
      onConnectionChange(state);
      publish(IPC_CHANNELS.connection, state);
      // A fresh connection starts with the outputs off: a running roast puts its own back.
      if (state.status === 'connected') {
        roast.restoreOutputs().catch((error: unknown) => {
          logger.error('roast.restore-failed', { error: serializeError(error) });
        });
      } else if (state.status === 'disconnected') roast.stopRoasterCooling('disconnected');
      if (state.status === 'disconnected' || state.status === 'lost') pilot.stop(state.status);
      coach.sync();
    },
    onSafetyEvent: (event: SafetyEvent) => {
      const { roast, pilot, coach } = parts();
      publish(IPC_CHANNELS.safetyEvent, event);
      if (event.kind === 'tripped' && event.action === 'safe-stop') {
        roast.stopRoasterCooling('safety-stop');
        pilot.stop('safety-stop');
        coach.stop();
      }
    },
  };
}
