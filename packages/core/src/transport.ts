import type { Result } from '@roastpilot/shared';

/** Why a transport could not do what was asked. */
export interface TransportError {
  kind: 'disconnected';
  message: string;
}

/** Moves lines of text to and from a roaster board: serial now, Wi-Fi or Bluetooth later. */
export interface Transport {
  open(): Promise<Result<void, TransportError>>;
  /** Sends one line; the transport adds the line ending. */
  write(line: string): Promise<Result<void, TransportError>>;
  /** Called with each received line, without its line ending. */
  onLine(listener: (line: string) => void): void;
  /** Called when the connection drops or is closed. */
  onClose(listener: () => void): void;
  close(): Promise<void>;
}
