import type { AutoChargeSoonError, AutoResumeError, AutoStatus } from './auto-status';
import type {
  AddStock,
  AdjustStock,
  Bean,
  BeanFields,
  BeanId,
  RoastSetup,
  UpdateBean,
} from './bean';
import type { Reading } from './channels';
import type { ConnectionState, ConnectTarget, SerialPortInfo } from './connection';
import type { DriverError } from './driver-error';
import type { RoastsChange, SetOutputRequest, Snapshot } from './ipc';
import type { RendererLogEntry } from './log-entry';
import type { LogDay, LogDayRead, LogRecord } from './log-record';
import type {
  MakeBeanProfileError,
  MakeBeanProfileRequest,
  MakeProfileError,
  MakeProfileRequest,
} from './make-profile';
import type { Milestones } from './milestones';
import type { AutoProfile, ProfileEntry, ProfileError, ProfileId } from './profile';
import type { Result } from './result';
import type { RoastAction, RoastActionError, RoastState } from './roast';
import type { ExportRoastsRequest, SetRoastBeanRequest } from './roast-file';
import type { NewRoaster, Roaster, RoasterError, RoasterId } from './roaster';
import type { SafetyEvent, AcknowledgeError } from './safety-event';
import type {
  DeleteRoastError,
  RoastDetail,
  RoastId,
  RoastResult,
  RoastSummary,
  StorageError,
} from './saved-roast';
import type { Screen } from './screen';
import type { Settings, SettingsWriteError } from './settings';

// The renderer's side of the IPC contract (docs/spec/architecture.md), one interface per area
// (interface segregation): code that needs one area depends on that interface only.
// `RoastpilotApi` is all of them, as `window.roastpilot`.

/** Stops listening. */
export type Unsubscribe = () => void;

/** The roaster connection and its outputs. */
export interface RoasterApi {
  listPorts(): Promise<SerialPortInfo[]>;
  connect(target: ConnectTarget): Promise<Result<void, DriverError>>;
  /** Safe stop, then close the port. */
  disconnect(): Promise<void>;
  setOutput(request: SetOutputRequest): Promise<Result<void, DriverError>>;
  onReading(listener: (reading: Reading) => void): Unsubscribe;
  onConnection(listener: (state: ConnectionState) => void): Unsubscribe;
}

export interface SafetyApi {
  /** Safe stop and lock the heater until acknowledged. */
  emergencyStop(): Promise<void>;
  acknowledgeSafety(): Promise<Result<void, AcknowledgeError>>;
  onSafetyEvent(listener: (event: SafetyEvent) => void): Unsubscribe;
}

export interface RoastApi {
  roastAction(action: RoastAction): Promise<Result<void, RoastActionError>>;
  onRoast(listener: (state: RoastState) => void): Unsubscribe;
}

export interface SettingsApi {
  getSettings(): Promise<Settings>;
  /** Saves and returns what was saved (unknown or bad fields fall back to defaults). */
  setSettings(settings: Settings): Promise<Result<Settings, SettingsWriteError>>;
}

/** The log: writing from the renderer and the log viewer. */
export interface LogsApi {
  /** Fire and forget: sends a renderer error or event to main's log. */
  log(entry: RendererLogEntry): void;
  /** Days with a log file, newest first. */
  listLogDays(): Promise<LogDay[]>;
  readLogDay(day: LogDay): Promise<LogDayRead>;
  /** New log entries as they are written, in batches. */
  onLogEntries(listener: (records: LogRecord[]) => void): Unsubscribe;
  openLogFolder(): Promise<void>;
}

export type ExportRoastsResult = { status: 'cancelled' } | { status: 'saved'; fileName: string };
export type ExportRoastsError = StorageError | { kind: 'write-failed' };
export type ImportArtisanResult = { status: 'cancelled' } | { status: 'imported'; id: RoastId };
export type ImportArtisanError = StorageError | { kind: 'read-failed' } | { kind: 'not-artisan' };
export type ImportRoastsResult =
  | { status: 'cancelled' }
  /** `newestId`: the newest roast added, for History to open; null when all were already here. */
  | { status: 'imported'; added: number; skipped: number; newestId: RoastId | null };
export type ImportRoastsError =
  StorageError | { kind: 'read-failed' } | { kind: 'not-roastpilot' } | { kind: 'newer-version' };

/** Saved roasts (docs/spec/ui.md, History screen). */
export interface HistoryApi {
  /** Every roast, or the ones named, as a Roastpilot file or a CSV; main asks where. */
  exportRoasts(
    request: ExportRoastsRequest,
  ): Promise<Result<ExportRoastsResult, ExportRoastsError>>;
  /** Reads a Roastpilot file; roasts already in History are skipped. */
  importRoasts(): Promise<Result<ImportRoastsResult, ImportRoastsError>>;
  /** Links a saved roast to a bean, or none (docs/spec/data-model.md). */
  setRoastBean(request: SetRoastBeanRequest): Promise<Result<void, StorageError>>;
  /** Asks for an Artisan `.alog`, then saves it as a new roast. */
  importArtisan(): Promise<Result<ImportArtisanResult, ImportArtisanError>>;
  /** Newest first; an empty list when storage can't be read (logged in main). */
  listRoasts(): Promise<RoastSummary[]>;
  getRoast(id: RoastId): Promise<Result<RoastDetail, StorageError>>;
  /** Refuses the roast being saved right now (`in-progress`). */
  deleteRoast(id: RoastId): Promise<Result<void, DeleteRoastError>>;
  /** A roast was saved, finished or deleted. */
  onRoastsChanged(listener: (change: RoastsChange) => void): Unsubscribe;
}

/** Auto mode (docs/spec/roast-control.md, Auto mode); on or off is the `roastMode` setting. */
export interface AutoApi {
  /** Heater 0 and the countdown before the beans go in. */
  autoChargeSoon(): Promise<Result<void, AutoChargeSoonError>>;
  /** Hands heater and fan back to Auto; refused while the heater is locked. */
  autoResume(): Promise<Result<void, AutoResumeError>>;
  onAutoStatus(listener: (status: AutoStatus) => void): Unsubscribe;
}

/** The Profiles screen (docs/spec/ui.md). */
export interface ProfilesApi {
  /** Built-ins first; only the built-ins when storage can't be read (logged in main). */
  listProfiles(): Promise<ProfileEntry[]>;
  /** Saves a copy as your own, and returns it. */
  duplicateProfile(id: ProfileId): Promise<Result<ProfileEntry, ProfileError>>;
  /** Refuses a built-in. */
  saveProfile(profile: AutoProfile): Promise<Result<ProfileEntry, ProfileError>>;
  /** Refuses a built-in. */
  deleteProfile(id: ProfileId): Promise<Result<void, ProfileError>>;
  /** A copy on another roaster, marked "needs calibration". */
  copyProfile(request: {
    id: ProfileId;
    roasterId: RoasterId;
  }): Promise<Result<ProfileEntry, ProfileError>>;
  /** A new curve profile of your own on the active roaster, from the milestone builder. */
  makeProfileFromMilestones(milestones: Milestones): Promise<Result<ProfileEntry, ProfileError>>;
}

/** Beans and stock (docs/spec/batch-and-stock.md). The stores follow `onBeans`. */
export interface BeansApi {
  /** Empty when storage can't be read (logged in main). */
  listBeans(): Promise<Bean[]>;
  addBean(fields: BeanFields): Promise<Result<BeanId, StorageError>>;
  updateBean(update: UpdateBean): Promise<Result<void, StorageError>>;
  setBeanArchived(request: { id: BeanId; archived: boolean }): Promise<Result<void, StorageError>>;
  addStock(stock: AddStock): Promise<Result<void, StorageError>>;
  adjustStock(stock: AdjustStock): Promise<Result<void, StorageError>>;
  onBeans(listener: (beans: Bean[]) => void): Unsubscribe;
  /**
   * The bean's own profile in one step: copies `profileId`, names it after the bean, saves it and
   * links it. All or nothing: a failure leaves no copy behind.
   */
  makeBeanProfile(
    request: MakeBeanProfileRequest,
  ): Promise<Result<ProfileEntry, MakeBeanProfileError>>;
  /** What the next roast is of; read at charge. */
  setRoastSetup(setup: RoastSetup): Promise<void>;
  /** Roasted weight, rating, star and notes. */
  saveRoastResult(result: RoastResult): Promise<Result<void, StorageError>>;
  /** A new profile of your own from a saved roast, on the roaster it ran on. */
  makeProfileFromRoast(
    request: MakeProfileRequest,
  ): Promise<Result<ProfileEntry, MakeProfileError>>;
}

/** Roaster records (docs/spec/roasters.md). Changes wait while one is connected. */
export interface RoastersApi {
  listRoasters(): Promise<Roaster[]>;
  addRoaster(roaster: NewRoaster): Promise<Result<Roaster, RoasterError>>;
  saveRoaster(roaster: Roaster): Promise<Result<Roaster, RoasterError>>;
  deleteRoaster(id: RoasterId): Promise<Result<void, RoasterError>>;
  setActiveRoaster(id: RoasterId): Promise<Result<void, RoasterError>>;
  /** Picks a port or the Simulator: the roaster of that kind becomes active and keeps it. */
  chooseConnection(target: ConnectTarget): Promise<Result<void, RoasterError>>;
  onRoasters(listener: (roasters: Roaster[]) => void): Unsubscribe;
}

/** The window itself: what it needs when it opens, and where the app menu sends it. */
export interface AppApi {
  getSnapshot(): Promise<Snapshot>;
  /** The app menu asked for a screen (Settings… ⌘,). */
  onNavigate(listener: (screen: Screen) => void): Unsubscribe;
  /** Help → Safety notice. */
  onShowSafetyNotice(listener: () => void): Unsubscribe;
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
    ProfilesApi,
    RoastersApi,
    BeansApi,
    AppApi {}
