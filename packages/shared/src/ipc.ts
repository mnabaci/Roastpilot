import { z } from 'zod';
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
import type { Result } from './result';
import {
  RoastStateSchema,
  type RoastAction,
  type RoastActionError,
  type RoastState,
} from './roast';
import type { Screen } from './screen';
import type { Settings, SettingsWriteError } from './settings';
import type { AcknowledgeError, SafetyEvent } from './safety-event';

/** Every IPC channel, in one place (docs/spec/architecture.md, IPC contract). */
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
} as const;

/** Everything a window needs when it opens or reloads mid-roast. */
export const SnapshotSchema = z.object({
  connection: ConnectionStateSchema,
  roast: RoastStateSchema,
  /** Readings of the current roast (or the last minutes before one). */
  readings: z.array(ReadingSchema),
  safety: z.object({ locked: z.boolean(), tripped: z.array(z.string()) }),
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

/** The window itself: what it needs when it opens, and where the app menu sends it. */
export interface AppApi {
  getSnapshot(): Promise<Snapshot>;
  /** The app menu asked for a screen (Settings… ⌘,). */
  onNavigate(listener: (screen: Screen) => void): Unsubscribe;
}

/** The typed API the preload script exposes to the renderer as `window.roastpilot`. */
export interface RoastpilotApi
  extends RoasterApi, SafetyApi, RoastApi, SettingsApi, LogsApi, AppApi {}
