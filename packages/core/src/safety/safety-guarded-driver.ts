import { err, type Channel, type Reading, type Result } from '@roastpilot/shared';
import type { DriverError, RoasterDriver } from '../roaster-driver';
import { HEATER } from './safety-rule';
import type { SafetyMonitor } from './safety-monitor';

/** The only driver the app talks to: feeds every reading to the monitor and enforces its heater lock. */
export class SafetyGuardedDriver implements RoasterDriver {
  readonly #inner: RoasterDriver;
  readonly #monitor: SafetyMonitor;

  constructor(inner: RoasterDriver, monitor: SafetyMonitor) {
    this.#inner = inner;
    this.#monitor = monitor;
  }

  get channels(): readonly Channel[] {
    return this.#inner.channels;
  }

  async connect(): Promise<Result<void, DriverError>> {
    const result = await this.#inner.connect();
    if (result.ok) this.#monitor.connected();
    return result;
  }

  async read(): Promise<Result<Reading, DriverError>> {
    const result = await this.#inner.read();
    this.#monitor.recordRead(result);
    return result;
  }

  setOutput(channel: string, value: number): Promise<Result<void, DriverError>> {
    if (channel === HEATER && value > 0 && this.#monitor.locked) {
      return Promise.resolve(err({ kind: 'safety-locked', channel }));
    }
    return this.#inner.setOutput(channel, value);
  }

  safeStop(): Promise<void> {
    return this.#inner.safeStop();
  }

  /**
   * A deliberate disconnect: the monitor stops watching for a lost connection before the close, so
   * a close that never finishes can't leave it armed, nor disarm a later connection when it does.
   */
  disconnect(): Promise<void> {
    this.#monitor.disconnected();
    return this.#inner.disconnect();
  }
}
