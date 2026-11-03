import { serializeError, type Logger } from '@roastpilot/core';
import type { RoastpilotApi, Unsubscribe } from '@roastpilot/shared';
import { addReading, setRoast } from '../stores/roast-store';
import { applySafetyEvent } from '../stores/safety-store';
import type { Stores } from '../stores/stores';

type SyncApi = Pick<
  RoastpilotApi,
  'getSnapshot' | 'getSettings' | 'onReading' | 'onConnection' | 'onSafetyEvent' | 'onRoast'
>;

/**
 * Keeps the stores a mirror of main: listens first, then loads the snapshot, so nothing that
 * happens in between is lost (the snapshot already includes it).
 */
export function syncWithMain(api: SyncApi, stores: Stores, logger: Logger): Unsubscribe {
  const stops = [
    api.onReading((reading) => {
      stores.roast.setState((data) => addReading(data, reading));
    }),
    api.onConnection((connection) => {
      stores.connection.setState({ connection });
    }),
    api.onSafetyEvent((event) => {
      stores.safety.setState((state) => applySafetyEvent(state, event), true);
    }),
    api.onRoast((roast) => {
      stores.roast.setState((data) => setRoast(data, roast));
    }),
  ];
  Promise.all([api.getSnapshot(), api.getSettings()])
    .then(([snapshot, settings]) => {
      stores.connection.setState({ connection: snapshot.connection });
      stores.roast.setState({ roast: snapshot.roast, readings: [...snapshot.readings] });
      stores.safety.setState(snapshot.safety, true);
      stores.settings.setState({ settings });
      stores.sync.setState({ ready: true });
    })
    .catch((error: unknown) => {
      logger.error('sync.snapshot-failed', { error: serializeError(error) });
      // Show the screens anyway; events keep them current from here.
      stores.sync.setState({ ready: true });
    });
  return () => {
    for (const stop of stops) stop();
  };
}
