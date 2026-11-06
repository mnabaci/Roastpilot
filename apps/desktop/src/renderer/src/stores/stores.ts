import type {
  AutoStatus,
  Bean,
  ConnectionState,
  ProfileEntry,
  Reading,
  Roaster,
  RoastSetup,
  RoastState,
  Settings,
} from '@roastpilot/shared';
import { createAutoStore, type AutoStore } from './auto-store';
import { createBeansStore, type BeansStore } from './beans-store';
import { createConnectionStore, type ConnectionStore } from './connection-store';
import { createRoastersStore, type RoastersStore } from './roasters-store';
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
  auto: AutoStore;
  roasters: RoastersStore;
  beans: BeansStore;
}

/** Starting values, mostly for tests. */
export interface StoresSeed {
  ready?: boolean;
  connection?: ConnectionState;
  roast?: RoastState;
  readings?: Reading[];
  safety?: SafetyState;
  settings?: Settings;
  auto?: AutoStatus;
  profiles?: ProfileEntry[];
  roasters?: Roaster[];
  beans?: Bean[];
  setup?: RoastSetup;
  currentRoastId?: number;
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
    auto: createAutoStore(seed.auto, seed.profiles),
    roasters: createRoastersStore(seed.roasters),
    beans: createBeansStore(seed.beans, seed.setup, seed.currentRoastId),
  };
}
