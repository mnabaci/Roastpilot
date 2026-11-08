import {
  AUTO_OFF,
  COACH_QUIET,
  DEFAULT_SETTINGS,
  NO_ROAST_SETUP,
  READY_ROAST,
  UPDATES_OFF,
  ok,
  type AppApi,
  type LogsApi,
  type SettingsApi,
  type UpdatesApi,
} from '@roastpilot/shared';
import { accepted, done, listening } from './answers';

/** A fresh window: disconnected, ready to roast, nothing tripped. */
export const fakeWindowApi = (): AppApi => ({
  getSnapshot: () =>
    Promise.resolve({
      connection: { status: 'disconnected' } as const,
      roast: READY_ROAST,
      readings: [],
      safety: { locked: false, tripped: [] },
      auto: AUTO_OFF,
      coach: COACH_QUIET,
      setup: NO_ROAST_SETUP,
      currentRoastId: null,
    }),
  onNavigate: listening,
  onShowSafetyNotice: listening,
});

/** Default settings, saved as sent; an empty log. */
export const fakeSettingsApi = (): SettingsApi & LogsApi => ({
  getSettings: () => Promise.resolve(DEFAULT_SETTINGS),
  setSettings: (settings) => Promise.resolve(ok(settings)),
  log: () => undefined,
  listLogDays: () => Promise.resolve([]),
  readLogDay: () => Promise.resolve({ records: [], unreadable: 0, truncated: false }),
  onLogEntries: listening,
  openLogFolder: done,
});

/** Version 0.1.0 with updates off. */
export const fakeUpdatesApi = (): UpdatesApi => ({
  getAppInfo: () => Promise.resolve({ version: '0.1.0', update: UPDATES_OFF }),
  checkForUpdates: done,
  restartToUpdate: accepted,
  openReleasePage: accepted,
  onUpdateStatus: listening,
});
