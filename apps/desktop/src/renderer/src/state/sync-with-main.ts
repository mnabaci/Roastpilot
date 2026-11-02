import { serializeError, type Logger } from '@roastpilot/core';
import type { RoastpilotApi, Unsubscribe } from '@roastpilot/shared';
import { applyReading, applyRoast, applySafetyEvent, applySnapshot } from './app-state';
import { update, type AppStore } from './app-store';

type SyncApi = Pick<
  RoastpilotApi,
  'getSnapshot' | 'getSettings' | 'onReading' | 'onConnection' | 'onSafetyEvent' | 'onRoast'
>;

/**
 * Keeps the store a mirror of main: listens first, then loads the snapshot, so nothing that
 * happens in between is lost (the snapshot already includes it).
 */
export function syncWithMain(api: SyncApi, store: AppStore, logger: Logger): Unsubscribe {
  const stops = [
    api.onReading((reading) => {
      update(store, applyReading, reading);
    }),
    api.onConnection((connection) => {
      store.setState({ connection });
    }),
    api.onSafetyEvent((event) => {
      update(store, applySafetyEvent, event);
    }),
    api.onRoast((roast) => {
      update(store, applyRoast, roast);
    }),
  ];
  Promise.all([api.getSnapshot(), api.getSettings()])
    .then(([snapshot, settings]) => {
      update(store, applySnapshot, snapshot);
      store.setState({ settings });
    })
    .catch((error: unknown) => {
      logger.error('sync.snapshot-failed', { error: serializeError(error) });
      // Show the screens anyway; events keep them current from here.
      store.setState({ ready: true });
    });
  return () => {
    for (const stop of stops) stop();
  };
}
