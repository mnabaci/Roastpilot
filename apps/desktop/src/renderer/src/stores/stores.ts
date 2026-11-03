import type { ConnectionState, Reading, RoastState, Settings } from '@roastpilot/shared';
import { createConnectionStore, type ConnectionStore } from './connection-store';
import { createRoastStore, type RoastStore } from './roast-store';
import { createSafetyStore, type SafetyState, type SafetyStore } from './safety-store';
import { createSettingsStore, type SettingsStore } from './settings-store';
import { createSyncStore, type SyncStore } from './sync-store';

/** One small store per concern, all fed by window.roastpilot events (app/sync-with-main.ts). */
export interface Stores {
  sync: SyncStore;
  connection: ConnectionStore;
  roast: RoastStore;
  safety: SafetyStore;
  settings: SettingsStore;
}

/** Starting values, mostly for tests. */
export interface StoresSeed {
  ready?: boolean;
  connection?: ConnectionState;
  roast?: RoastState;
  readings?: Reading[];
  safety?: SafetyState;
  settings?: Settings;
}

export function createStores(seed: StoresSeed = {}): Stores {
  return {
    sync: createSyncStore(seed.ready),
    connection: createConnectionStore(seed.connection),
    roast: createRoastStore({
      ...(seed.roast ? { roast: seed.roast } : {}),
      ...(seed.readings ? { readings: seed.readings } : {}),
    }),
    safety: createSafetyStore(seed.safety),
    settings: createSettingsStore(seed.settings),
  };
}
