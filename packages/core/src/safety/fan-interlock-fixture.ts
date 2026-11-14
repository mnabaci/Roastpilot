import {
  err,
  ok,
  type Channel,
  type LogEntry,
  type Reading,
  type Result,
} from '@roastpilot/shared';
import { createLogger } from '../logging/logger';
import type { DriverError, RoasterDriver } from '../roaster-driver';
import { FanInterlockDriver } from './fan-interlock-driver';

/** Records what reaches the roaster; `failing` channels refuse. */
export class RecordingDriver implements RoasterDriver {
  readonly channels: readonly Channel[] = [];
  readonly sent: [string, number][] = [];
  readonly failing = new Set<string>();
  /** Channels whose next command throws instead of returning a result. */
  readonly throwing = new Set<string>();
  connectResult: Result<void, DriverError> = ok(undefined);
  safeStops = 0;
  connect(): Promise<Result<void, DriverError>> {
    return Promise.resolve(this.connectResult);
  }
  read(): Promise<Result<Reading, DriverError>> {
    return Promise.resolve(ok({ atMs: 0, values: {} }));
  }
  setOutput(channel: string, value: number): Promise<Result<void, DriverError>> {
    if (this.throwing.delete(channel)) return Promise.reject(new Error('port gone'));
    if (this.failing.has(channel)) return Promise.resolve(err({ kind: 'disconnected' }));
    this.sent.push([channel, value]);
    return Promise.resolve(ok(undefined));
  }
  safeStop(): Promise<void> {
    this.safeStops++;
    return Promise.resolve();
  }
  disconnect(): Promise<void> {
    return Promise.resolve();
  }
}

/** A connected interlock over a recording roaster, with its log events. */
export async function setup(minFanPct = 40) {
  const inner = new RecordingDriver();
  const entries: LogEntry[] = [];
  const driver = new FanInterlockDriver(
    inner,
    minFanPct,
    createLogger({ write: (e) => entries.push(e) }, 'driver'),
  );
  await driver.connect();
  return { inner, driver, events: () => entries.map((e) => e.event) };
}
