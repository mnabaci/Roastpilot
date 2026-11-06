import { z } from 'zod';
import {
  AutoStatusSchema,
  type AutoChargeSoonError,
  type AutoResumeError,
  type AutoStatus,
} from './auto-status';
import { RoastSetupSchema } from './bean';
import { ReadingSchema, type Reading } from './channels';
import {
  ConnectionStateSchema,
  type ConnectionState,
  type ConnectTarget,
  type SerialPortInfo,
} from './connection';
import type { DriverError } from './driver-error';
import type { RendererLogEntry } from './log-entry';
import type { LogDay, LogDayRead, LogRecord } from './log-record';
import type { AutoProfile, ProfileEntry, ProfileError, ProfileId } from './profile';
import type {
  AddStock,
  AdjustStock,
  Bean,
  BeanFields,
  BeanId,
  RoastSetup,
  UpdateBean,
} from './bean';
import type { MakeProfileError, MakeProfileRequest } from './make-profile';
import type { Result } from './result';
import type { NewRoaster, Roaster, RoasterError, RoasterId } from './roaster';
import {
  RoastStateSchema,
  type RoastAction,
  type RoastActionError,
  type RoastState,
} from './roast';
import type {
  DeleteRoastError,
  RoastDetail,
  RoastId,
  RoastSummary,
  StorageError,
} from './saved-roast';
import type { ExportRoastsRequest, SetRoastBeanRequest } from './roast-file';
import { RoastIdSchema, type RoastResult } from './saved-roast';
import type { Screen } from './screen';
import type { Settings, SettingsWriteError } from './settings';
import type { AcknowledgeError, SafetyEvent } from './safety-event';

/** Every IPC channel, in one place (docs/spec/architecture.md, IPC contract). */
/** A saved roast changed; `current` when it's the roast on the Roast screen. */
export interface RoastsChange {
  id: RoastId;
  deleted: boolean;
  current?: boolean;
}

export const IPC_CHANNELS = {
  listPorts: 'roaster:list-ports',
  connect: 'roaster:connect',
  disconnect: 'roaster:disconnect',
  setOutput: 'roaster:set-output',
  emergencyStop: 'roaster:emergency-stop',
  acknowledgeSafety: 'safety:acknowledge',
  reading: 'roaster:reading',
  connection: 'roaster:connection',
  safetyEvent: 'safety:event',
  log: 'app:log',
  getSnapshot: 'app:get-snapshot',
  roastAction: 'roast:action',
  roast: 'roast:state',
  getSettings: 'settings:get',
  setSettings: 'settings:set',
  listLogDays: 'logs:list-days',
  readLogDay: 'logs:read-day',
  logEntries: 'logs:entries',
  openLogFolder: 'logs:open-folder',
  navigate: 'app:navigate',
  listRoasts: 'history:list',
  getRoast: 'history:get',
  deleteRoast: 'history:delete',
  exportRoasts: 'history:export',
  importRoasts: 'history:import',
  setRoastBean: 'history:set-bean',
  importArtisan: 'history:import-artisan',
  roastsChanged: 'history:changed',
  autoStatus: 'auto:status',
  autoChargeSoon: 'auto:charge-soon',
  autoResume: 'auto:resume',
  listProfiles: 'profiles:list',
  duplicateProfile: 'profiles:duplicate',
  saveProfile: 'profiles:save',
  deleteProfile: 'profiles:delete',
  copyProfile: 'profiles:copy',
  listRoasters: 'roasters:list',
  addRoaster: 'roasters:add',
  saveRoaster: 'roasters:save',
  deleteRoaster: 'roasters:delete',
  setActiveRoaster: 'roasters:set-active',
  chooseConnection: 'roasters:choose-connection',
  roastersChanged: 'roasters:changed',
  listBeans: 'beans:list',
  addBean: 'beans:add',
  updateBean: 'beans:update',
  setBeanArchived: 'beans:set-archived',
  addStock: 'beans:add-stock',
  adjustStock: 'beans:adjust-stock',
  beansChanged: 'beans:changed',
  setRoastSetup: 'roast:set-setup',
  saveRoastResult: 'history:save-result',
  makeProfileFromRoast: 'history:make-profile',
} as const;

/** Everything a window needs when it opens or reloads mid-roast. */
export const SnapshotSchema = z.object({
  connection: ConnectionStateSchema,
  roast: RoastStateSchema,
  /** Readings of the current roast (or the last minutes before one). */
  readings: z.array(ReadingSchema),
  safety: z.object({ locked: z.boolean(), tripped: z.array(z.string()) }),
  auto: AutoStatusSchema,
  setup: RoastSetupSchema,
  /** The roast on screen, once its row exists; null with none. */
  currentRoastId: RoastIdSchema.nullable(),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

/** Payload of each main → renderer event, so senders and listeners share one type. */
export interface IpcEventPayloads {
  [IPC_CHANNELS.reading]: Reading;
  [IPC_CHANNELS.connection]: ConnectionState;
  [IPC_CHANNELS.safetyEvent]: SafetyEvent;
  [IPC_CHANNELS.roast]: RoastState;
  [IPC_CHANNELS.logEntries]: LogRecord[];
  [IPC_CHANNELS.navigate]: Screen;
  [IPC_CHANNELS.roastsChanged]: RoastsChange;
  [IPC_CHANNELS.autoStatus]: AutoStatus;
  [IPC_CHANNELS.roastersChanged]: Roaster[];
  [IPC_CHANNELS.beansChanged]: Bean[];
}
export type IpcEventChannel = keyof IpcEventPayloads;

export const SetOutputRequestSchema = z.object({
  channel: z.string().min(1),
  value: z.number(),
});
export type SetOutputRequest = z.infer<typeof SetOutputRequestSchema>;

/** Stops listening. */
export type Unsubscribe = () => void;

// The renderer API, one interface per area (interface segregation): code that needs one area
// depends on that interface only. `RoastpilotApi` is all of them, as `window.roastpilot`.

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
  { status: 'cancelled' } | { status: 'imported'; added: number; skipped: number };
export type ImportRoastsError =
  StorageError | { kind: 'read-failed' } | { kind: 'not-roastpilot' } | { kind: 'newer-version' };

/** Saved roasts (docs/spec/ui.md, History screen). */
export interface HistoryApi {
  /** Asks where to save, then writes every saved roast as CSV. */
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
