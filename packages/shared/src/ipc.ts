import { z } from 'zod';
import type { Reading } from './channels';
import type { ConnectionState, ConnectTarget, SerialPortInfo } from './connection';
import type { DriverError } from './driver-error';
import type { RendererLogEntry } from './log-entry';
import type { Result } from './result';
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
} as const;

/** Payload of each main → renderer event, so senders and listeners share one type. */
export interface IpcEventPayloads {
  [IPC_CHANNELS.reading]: Reading;
  [IPC_CHANNELS.connection]: ConnectionState;
  [IPC_CHANNELS.safetyEvent]: SafetyEvent;
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
}
