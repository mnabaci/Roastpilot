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
import type { Result } from './result';
import {
  RoastStateSchema,
  type RoastAction,
  type RoastActionError,
  type RoastState,
} from './roast';
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
}
export type IpcEventChannel = keyof IpcEventPayloads;

export const SetOutputRequestSchema = z.object({
  channel: z.string().min(1),
  value: z.number(),
});
export type SetOutputRequest = z.infer<typeof SetOutputRequestSchema>;

/** Stops listening. */
export type Unsubscribe = () => void;

/** The typed API the preload script exposes to the renderer as `window.roastpilot`. */
export interface RoastpilotApi {
  listPorts(): Promise<SerialPortInfo[]>;
  connect(target: ConnectTarget): Promise<Result<void, DriverError>>;
  /** Safe stop, then close the port. */
  disconnect(): Promise<void>;
  setOutput(request: SetOutputRequest): Promise<Result<void, DriverError>>;
  /** Safe stop and lock the heater until acknowledged. */
  emergencyStop(): Promise<void>;
  acknowledgeSafety(): Promise<Result<void, AcknowledgeError>>;
  onReading(listener: (reading: Reading) => void): Unsubscribe;
  onConnection(listener: (state: ConnectionState) => void): Unsubscribe;
  onSafetyEvent(listener: (event: SafetyEvent) => void): Unsubscribe;
  /** Fire and forget: sends a renderer error or event to main's log. */
  log(entry: RendererLogEntry): void;
  getSnapshot(): Promise<Snapshot>;
  roastAction(action: RoastAction): Promise<Result<void, RoastActionError>>;
  onRoast(listener: (state: RoastState) => void): Unsubscribe;
  getSettings(): Promise<Settings>;
  /** Saves and returns what was saved (unknown or bad fields fall back to defaults). */
  setSettings(settings: Settings): Promise<Result<Settings, SettingsWriteError>>;
}
