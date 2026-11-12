import type { AutoStatus } from './auto-status';
import type { Bean } from './bean';
import type { Reading } from './channels';
import type { CoachStatus } from './coach';
import type { ConnectionState } from './connection';
import type { INVOKE_CHANNELS as C, RoastsChange } from './ipc';
import type { Invoke, InvokeResult } from './ipc-contract';
import type { LibraryKind } from './library-file';
import type { RendererLogEntry } from './log-entry';
import type { LogRecord } from './log-record';
import type { ProfileEntry } from './profile';
import type { RoastState } from './roast';
import type { Roaster } from './roaster';
import type { SafetyEvent } from './safety-event';
import type { Screen } from './screen';
import type { UpdateStatus } from './update-status';

// The renderer's side of the IPC contract (docs/spec/architecture.md), one interface per area
// (interface segregation): code that needs one area depends on that interface only.
// `RoastpilotApi` is all of them, as `window.roastpilot`. Each call's payload and result come
// from `InvokeContract`, the types main's handlers are checked against.

/** Stops listening. */
export type Unsubscribe = () => void;

/** The roaster connection and its outputs. */
export interface RoasterApi {
  listPorts: Invoke<typeof C.listPorts>;
  connect: Invoke<typeof C.connect>;
  /** Safe stop, then close the port. */
  disconnect: Invoke<typeof C.disconnect>;
  setOutput: Invoke<typeof C.setOutput>;
  onReading(listener: (reading: Reading) => void): Unsubscribe;
  onConnection(listener: (state: ConnectionState) => void): Unsubscribe;
}

export interface SafetyApi {
  /** Safe stop and lock the heater until acknowledged. */
  emergencyStop: Invoke<typeof C.emergencyStop>;
  acknowledgeSafety: Invoke<typeof C.acknowledgeSafety>;
  onSafetyEvent(listener: (event: SafetyEvent) => void): Unsubscribe;
}

export interface RoastApi {
  roastAction: Invoke<typeof C.roastAction>;
  onRoast(listener: (state: RoastState) => void): Unsubscribe;
}

export interface SettingsApi {
  getSettings: Invoke<typeof C.getSettings>;
  /** Saves and returns what was saved (unknown or bad fields fall back to defaults). */
  setSettings: Invoke<typeof C.setSettings>;
}

/** The log: writing from the renderer and the log viewer. */
export interface LogsApi {
  /** Fire and forget: sends a renderer error or event to main's log. */
  log(entry: RendererLogEntry): void;
  /** Days with a log file, newest first. */
  listLogDays: Invoke<typeof C.listLogDays>;
  readLogDay: Invoke<typeof C.readLogDay>;
  /** New log entries as they are written, in batches. */
  onLogEntries(listener: (records: LogRecord[]) => void): Unsubscribe;
  openLogFolder: Invoke<typeof C.openLogFolder>;
}

/** Saved roasts (docs/spec/ui.md, History screen). */
export interface HistoryApi {
  /** Every roast, or the ones named, as a Roastpilot file or a CSV; main asks where. */
  exportRoasts: Invoke<typeof C.exportRoasts>;
  /** Reads a Roastpilot file; roasts already in History are skipped. */
  importRoasts: Invoke<typeof C.importRoasts>;
  /** Links a saved roast to a bean, or none (docs/spec/data-model.md). */
  setRoastBean: Invoke<typeof C.setRoastBean>;
  /** Asks for an Artisan `.alog`, then saves it as a new roast. */
  importArtisan: Invoke<typeof C.importArtisan>;
  /** Newest first; an empty list when storage can't be read (logged in main). */
  listRoasts: Invoke<typeof C.listRoasts>;
  getRoast: Invoke<typeof C.getRoast>;
  /** Refuses the roast being saved right now (`in-progress`). */
  deleteRoast: Invoke<typeof C.deleteRoast>;
  /** A roast was saved, finished or deleted. */
  onRoastsChanged(listener: (change: RoastsChange) => void): Unsubscribe;
}

/** Auto mode (docs/spec/roast-control.md, Auto mode); on or off is the `roastMode` setting. */
export interface AutoApi {
  /** Heater 0 and the countdown before the beans go in. */
  autoChargeSoon: Invoke<typeof C.autoChargeSoon>;
  /** Hands heater and fan back to Auto; refused while the heater is locked. */
  autoResume: Invoke<typeof C.autoResume>;
  /** This roast's preheat hold, or null for the one picked for the batch; a running hold follows. */
  autoSetPreheatHold: Invoke<typeof C.autoSetPreheatHold>;
  onAutoStatus(listener: (status: AutoStatus) => void): Unsubscribe;
}

/** The coach card in a manual roast (docs/spec/manual-mode.md, Coach). */
export interface CoachApi {
  /** Sets the card's outputs as the sliders do and records it; refused once the card has changed. */
  coachApply: Invoke<typeof C.coachApply>;
  /** Hides the card; a card that has already changed is left alone. */
  coachDismiss: Invoke<typeof C.coachDismiss>;
  onCoachStatus(listener: (status: CoachStatus) => void): Unsubscribe;
}

/** The Profiles screen (docs/spec/ui.md). */
export interface ProfilesApi {
  /** Built-ins first; only the built-ins when storage can't be read (logged in main). */
  listProfiles: Invoke<typeof C.listProfiles>;
  /** Saves a copy as your own, and returns it. */
  duplicateProfile: Invoke<typeof C.duplicateProfile>;
  /** Refuses a built-in. */
  saveProfile: Invoke<typeof C.saveProfile>;
  /** Refuses a built-in. */
  deleteProfile: Invoke<typeof C.deleteProfile>;
  /** Several of your own in one write, all or nothing; refuses them all if one is a built-in. */
  deleteProfiles: Invoke<typeof C.deleteProfiles>;
  /** A copy on another roaster, marked "needs calibration". */
  copyProfile: Invoke<typeof C.copyProfile>;
  /** A new curve profile of your own on the active roaster, from the milestone builder. */
  makeProfileFromMilestones: Invoke<typeof C.makeProfileFromMilestones>;
  /** The list changed: a write, or another roaster became active. The stores follow it. */
  onProfiles(listener: (profiles: ProfileEntry[]) => void): Unsubscribe;
}

/** Beans and stock (docs/spec/batch-and-stock.md). The stores follow `onBeans`. */
export interface BeansApi {
  /** Empty when storage can't be read (logged in main). */
  listBeans: Invoke<typeof C.listBeans>;
  addBean: Invoke<typeof C.addBean>;
  updateBean: Invoke<typeof C.updateBean>;
  setBeanArchived: Invoke<typeof C.setBeanArchived>;
  /** Opens the bean's saved order link in the browser; main reads the link, never the caller. */
  openBeanLink: Invoke<typeof C.openBeanLink>;
  addStock: Invoke<typeof C.addStock>;
  adjustStock: Invoke<typeof C.adjustStock>;
  /** What moved the bean's stock, oldest first: purchases, roasts made here, adjustments. */
  stockHistory: Invoke<typeof C.stockHistory>;
  onBeans(listener: (beans: Bean[]) => void): Unsubscribe;
  /**
   * The bean's own profile in one step: copies `profileId`, names it after the bean, saves it and
   * links it. All or nothing: a failure leaves no copy behind.
   */
  makeBeanProfile: Invoke<typeof C.makeBeanProfile>;
  /** What the next roast is of; read at charge. */
  setRoastSetup: Invoke<typeof C.setRoastSetup>;
  /** Roasted weight, rating, star and notes. */
  saveRoastResult: Invoke<typeof C.saveRoastResult>;
  /** A new profile of your own from a saved roast, on the roaster it ran on. */
  makeProfileFromRoast: Invoke<typeof C.makeProfileFromRoast>;
}

/** Roaster records (docs/spec/roasters.md). Changes wait while one is connected. */
export interface RoastersApi {
  listRoasters: Invoke<typeof C.listRoasters>;
  addRoaster: Invoke<typeof C.addRoaster>;
  saveRoaster: Invoke<typeof C.saveRoaster>;
  deleteRoaster: Invoke<typeof C.deleteRoaster>;
  setActiveRoaster: Invoke<typeof C.setActiveRoaster>;
  /** Picks a port or the Simulator: the roaster of that kind becomes active and keeps it. */
  chooseConnection: Invoke<typeof C.chooseConnection>;
  onRoasters(listener: (roasters: Roaster[]) => void): Unsubscribe;
}

/**
 * Beans, profiles and roasters as Roastpilot files (docs/spec/data-model.md, Beans, profiles and
 * roasters files). Main asks where; nothing is ever overwritten.
 */
export interface LibraryFilesApi {
  /** Every item of the kind, or the ones named. */
  exportLibrary: Invoke<typeof C.exportLibrary>;
  /** Asks for a file of the kind; the same ones are skipped, clashes come in renamed. */
  importLibrary(kind: LibraryKind): Promise<InvokeResult<typeof C.importLibrary>>;
}

/** The window itself: what it needs when it opens, and where the app menu sends it. */
export interface AppApi {
  getSnapshot: Invoke<typeof C.getSnapshot>;
  /** The app menu asked for a screen (Settings… ⌘,). */
  onNavigate(listener: (screen: Screen) => void): Unsubscribe;
  /** Help → Safety notice. */
  onShowSafetyNotice(listener: () => void): Unsubscribe;
}

/** Settings › About: the version and updates (docs/spec/install-and-update.md). */
export interface UpdatesApi {
  getAppInfo: Invoke<typeof C.getAppInfo>;
  /** Checks now; the answer comes as `onUpdateStatus`. Does nothing while one is under way. */
  checkForUpdates: Invoke<typeof C.checkForUpdates>;
  /** Quits and installs the downloaded update; refused while a roast runs (`roasting`). */
  restartToUpdate: Invoke<typeof C.restartToUpdate>;
  /** Opens a release page on GitHub in the browser. */
  openReleasePage: Invoke<typeof C.openReleasePage>;
  onUpdateStatus(listener: (status: UpdateStatus) => void): Unsubscribe;
}

/** The typed API the preload script exposes to the renderer as `window.roastpilot`. */
export interface RoastpilotApi
  extends
    RoasterApi,
    SafetyApi,
    RoastApi,
    SettingsApi,
    LogsApi,
    HistoryApi,
    AutoApi,
    CoachApi,
    ProfilesApi,
    RoastersApi,
    BeansApi,
    LibraryFilesApi,
    AppApi,
    UpdatesApi {}
