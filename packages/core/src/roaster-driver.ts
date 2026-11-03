import type { Channel, DriverError, Reading, Result } from '@roastpilot/shared';

export type { DriverError } from '@roastpilot/shared';

/**
 * Everything the controller knows about a roaster (ADR 0009).
 * Outputs are addressed by the ids in `channels`; values are clamped and rounded by the driver.
 */
export interface RoasterDriver {
  readonly channels: readonly Channel[];
  connect(): Promise<Result<void, DriverError>>;
  read(): Promise<Result<Reading, DriverError>>;
  setOutput(channel: string, value: number): Promise<Result<void, DriverError>>;
  /** Heater off, air and cooling up. Never rejects: does what it can on a broken connection. */
  safeStop(): Promise<void>;
  /** Closes the connection. Does not change outputs: call safeStop first. Never rejects. */
  disconnect(): Promise<void>;
}
