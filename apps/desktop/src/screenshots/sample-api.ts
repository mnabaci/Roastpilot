import {
  err,
  ok,
  UPDATES_OFF,
  type RoastpilotApi,
  type Screen,
  type Unsubscribe,
} from '@roastpilot/shared';
import type { AppState } from './app-state';

const NOTHING: Unsubscribe = () => undefined;
const listening = (): Unsubscribe => NOTHING;
const done = () => Promise.resolve();
const accepted = () => Promise.resolve(ok(undefined));
const cancelled = () => Promise.resolve(ok({ status: 'cancelled' as const }));
const frozen = () => Promise.resolve(err({ kind: 'storage-failed' as const, message: 'a sample' }));

/**
 * `window.roastpilot` for a scene: answers every question from the frozen state, opens `screen`
 * as the app menu would, and changes nothing (a picture has no roaster to talk to).
 */
export function sampleApi(state: AppState, screen: Screen): RoastpilotApi {
  return {
    getSnapshot: () => Promise.resolve(state.snapshot),
    getSettings: () => Promise.resolve(state.settings),
    listProfiles: () => Promise.resolve(state.profiles),
    listRoasters: () => Promise.resolve(state.roasters),
    listBeans: () => Promise.resolve(state.beans),
    listRoasts: () => Promise.resolve(state.roasts),
    getRoast: (id) => {
      const detail = state.details.find((d) => d.id === id);
      return Promise.resolve(detail ? ok(detail) : err({ kind: 'not-found' as const, id }));
    },
    getAppInfo: () => Promise.resolve({ version: '0.0.0', update: UPDATES_OFF }),
    onNavigate: (listener) => {
      listener(screen);
      return NOTHING;
    },
    // Asked for, never sent: a scene is one moment.
    onReading: listening,
    onConnection: listening,
    onSafetyEvent: listening,
    onRoast: listening,
    onAutoStatus: listening,
    onCoachStatus: listening,
    onRoastsChanged: listening,
    onRoasters: listening,
    onBeans: listening,
    onLogEntries: listening,
    onShowSafetyNotice: listening,
    onUpdateStatus: listening,
    // Actions do nothing and say they worked.
    log: () => undefined,
    listPorts: () => Promise.resolve([]),
    connect: accepted,
    disconnect: done,
    setOutput: accepted,
    emergencyStop: done,
    acknowledgeSafety: accepted,
    roastAction: accepted,
    setSettings: (settings) => Promise.resolve(ok(settings)),
    listLogDays: () => Promise.resolve([]),
    readLogDay: () => Promise.resolve({ records: [], unreadable: 0, truncated: false }),
    openLogFolder: done,
    deleteRoast: accepted,
    exportRoasts: cancelled,
    importRoasts: cancelled,
    importArtisan: cancelled,
    setRoastBean: accepted,
    autoChargeSoon: accepted,
    autoResume: accepted,
    coachApply: accepted,
    coachDismiss: done,
    duplicateProfile: frozen,
    saveProfile: frozen,
    deleteProfile: accepted,
    copyProfile: frozen,
    makeProfileFromMilestones: frozen,
    addRoaster: frozen,
    saveRoaster: (roaster) => Promise.resolve(ok(roaster)),
    deleteRoaster: accepted,
    setActiveRoaster: accepted,
    chooseConnection: accepted,
    addBean: frozen,
    updateBean: accepted,
    setBeanArchived: accepted,
    addStock: accepted,
    adjustStock: accepted,
    makeBeanProfile: frozen,
    setRoastSetup: done,
    saveRoastResult: accepted,
    makeProfileFromRoast: frozen,
    checkForUpdates: done,
    restartToUpdate: accepted,
    openReleasePage: accepted,
  };
}
