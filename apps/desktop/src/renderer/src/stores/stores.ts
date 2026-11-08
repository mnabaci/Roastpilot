import type {
  AutoStatus,
  Bean,
  CoachStatus,
  ConnectionState,
  ProfileEntry,
  Reading,
  Roaster,
  RoastSetup,
  RoastState,
  Settings,
  UpdateStatus,
} from '@roastpilot/shared';
import { createAutoStore, type AutoStore } from './auto-store';
import { createBeansStore, type BeansStore } from './beans-store';
import { createCoachStore, type CoachStore } from './coach-store';
import { createConnectionStore, type ConnectionStore } from './connection-store';
import { createRoastersStore, type RoastersStore } from './roasters-store';
import { createRoastStore, type RoastStore } from './roast-store';
import { createRoastViewStore, type RoastViewStore } from './roast-view-store';
import { createSafetyStore, type SafetyState, type SafetyStore } from './safety-store';
import { createSettingsStore, type SettingsStore } from './settings-store';
import { createSyncStore, type SyncStore } from './sync-store';
import { createToastsStore, type ToastsStore } from './toasts-store';
import { createUpdatesStore, type UpdatesStore } from './updates-store';

/** One small store per concern, all fed by window.roastpilot events (app/sync-with-main.ts). */
export interface Stores {
  sync: SyncStore;
  connection: ConnectionStore;
  roast: RoastStore;
  safety: SafetyStore;
  settings: SettingsStore;
  auto: AutoStore;
  coach: CoachStore;
  roasters: RoastersStore;
  beans: BeansStore;
  /** The installed version and updates (Settings › About, the Settings tab's dot). */
  updates: UpdatesStore;
  /** One-line notes for actions that failed where the screen shows nothing. */
  toasts: ToastsStore;
  /** The Roast chart's window and floor, kept while you visit other screens mid-roast. */
  roastView: RoastViewStore;
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
  coach?: CoachStatus;
  profiles?: ProfileEntry[];
  roasters?: Roaster[];
  beans?: Bean[];
  setup?: RoastSetup;
  currentRoastId?: number;
  version?: string;
  update?: UpdateStatus;
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
    coach: createCoachStore(seed.coach),
    roasters: createRoastersStore(seed.roasters),
    beans: createBeansStore(seed.beans, seed.setup, seed.currentRoastId),
    updates: createUpdatesStore(seed.version, seed.update),
    toasts: createToastsStore(),
    roastView: createRoastViewStore(),
  };
}
