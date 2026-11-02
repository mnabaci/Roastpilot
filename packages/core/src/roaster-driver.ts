import type { Channel, Reading, Result } from '@roastpilot/shared';

/** Expected failures a driver reports instead of throwing. */
export type DriverError =
  | { kind: 'disconnected' }
  | { kind: 'version-mismatch'; expected: number; actual: number }
  | { kind: 'bad-reply'; line: string }
  | { kind: 'unknown-channel'; channel: string };

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
}
