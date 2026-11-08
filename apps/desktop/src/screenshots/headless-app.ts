import { ManualClock, silentLogger, type SettingsStore } from '@roastpilot/core';
import { SimulatedDriver } from '@roastpilot/drivers';
import { DEFAULT_SETTINGS, ok, SAFETY_NOTICE_VERSION, type Settings } from '@roastpilot/shared';
import { createAppServices, type AppServices } from '../main/app-services';
import { SimulatorBeans } from '../main/simulator-beans';
import type { RetiredSoakSetting } from '../main/settings/move-soak';
import { openStores } from '../main/storage-wiring';

/** Main without Electron: the app's own services on a fake clock and an in-memory database. */
export interface HeadlessApp {
  clock: ManualClock;
  services: AppServices;
  /** Connects the Simulator the way the Roasters screen does. */
  connectSimulator: () => Promise<void>;
  /** Sets the wall clock that saved roasts are dated by; the fake clock keeps running from there. */
  setWallClock: (iso: string) => void;
  close: () => void;
}

/** The settings file, kept in memory; the safety notice is already accepted. */
function memorySettings(): SettingsStore & RetiredSoakSetting {
  let saved: Settings = { ...DEFAULT_SETTINGS, safetyNoticeAccepted: SAFETY_NOTICE_VERSION };
  return {
    load: () => Promise.resolve(saved),
    save: (settings) => {
      saved = settings;
      return Promise.resolve(ok(undefined));
    },
    retiredSoakS: () => undefined,
    forgetRetiredSoak: () => undefined,
  };
}

/**
 * Starts main's services headless, as `src/main/index.ts` wires them, minus the windows: the same
 * session, roast, Auto, coach, history and storage (SQLite in memory), driven by a fake clock.
 */
export async function startHeadlessApp(): Promise<HeadlessApp> {
  const clock = new ManualClock();
  const stores = openStores(':memory:', clock, silentLogger);
  const simulatorBeans = new SimulatorBeans();
  let wallStartMs = 0;
  let ownIds = 0;
  const services = createAppServices({
    clock,
    logger: silentLogger,
    settingsStore: memorySettings(),
    roasts: stores.roasts,
    profileStore: stores.profileStore,
    roasterStore: stores.roasterStore,
    beanStore: stores.beanStore,
    newProfileId: () => `custom-${String(++ownIds)}`,
    nowIso: () => new Date(wallStartMs + clock.now()).toISOString(),
    onConnectionChange: () => undefined,
    onRoastChange: (state) => {
      simulatorBeans.onRoast(state);
    },
    publish: () => undefined,
  });
  // Let the start-up loading (settings, roasters, profiles) finish.
  await clock.runFor(0);
  await services.profiles.list();
  return {
    clock,
    services,
    connectSimulator: async () => {
      const target = { kind: 'simulator' } as const;
      const chosen = await services.roasters.chooseConnection(target);
      if (!chosen.ok) throw new Error(`Simulator not chosen: ${JSON.stringify(chosen.error)}`);
      const driver = simulatorBeans.attach(new SimulatedDriver({ clock }));
      const connected = await services.session.connect(driver, target);
      if (!connected.ok) throw new Error(`Simulator not connected: ${JSON.stringify(connected)}`);
    },
    setWallClock: (iso) => {
      wallStartMs = Date.parse(iso) - clock.now();
    },
    close: stores.close,
  };
}
