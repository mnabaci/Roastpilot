import { silentLogger, type Logger } from '@roastpilot/core';
import type { Screen } from '@roastpilot/shared';
import type { AppDeps } from '../renderer/src/app/app-context';
import { syncWithMain } from '../renderer/src/app/sync-with-main';
import { createStores } from '../renderer/src/stores/stores';
import type { AppState } from './app-state';
import { sampleApi } from './sample-api';

/** What the app's provider gets in a scene: the sample api, synced stores, and no sound. */
export async function sceneDeps(
  state: AppState,
  screen: Screen,
  logger: Logger = silentLogger,
): Promise<AppDeps> {
  const api = sampleApi(state, screen);
  const stores = createStores();
  syncWithMain(api, stores, logger.child('sync'));
  // Draw once main has answered, as the app does after its first snapshot.
  await new Promise<void>((resolve) => {
    if (stores.sync.getState().ready) resolve();
    else
      stores.sync.subscribe(({ ready }) => {
        if (ready) resolve();
      });
  });
  return { api, stores, logger, chime: { play: () => undefined } };
}
