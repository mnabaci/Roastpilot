import {
  err,
  ok,
  type Channel,
  type LogEntry,
  type Reading,
  type Result,
} from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../logging/logger';
import type { DriverError, RoasterDriver } from '../roaster-driver';
import { FanInterlockDriver } from './fan-interlock-driver';

/** Records what reaches the roaster; `failing` channels refuse. */
class RecordingDriver implements RoasterDriver {
  readonly channels: readonly Channel[] = [];
  readonly sent: [string, number][] = [];
  readonly failing = new Set<string>();
  safeStops = 0;
  connect(): Promise<Result<void, DriverError>> {
    return Promise.resolve(ok(undefined));
  }
  read(): Promise<Result<Reading, DriverError>> {
    return Promise.resolve(ok({ atMs: 0, values: {} }));
  }
  setOutput(channel: string, value: number): Promise<Result<void, DriverError>> {
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

async function setup(minFanPct = 40) {
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

describe('FanInterlockDriver', () => {
  it('raises the fan to the minimum before the heater comes on', async () => {
    const { inner, driver } = await setup();
    expect((await driver.setOutput('heater', 60)).ok).toBe(true);
    expect(inner.sent).toEqual([
      ['fan', 40],
      ['heater', 60],
    ]);
  });

  it('leaves a fan already at or above the minimum alone', async () => {
    const { inner, driver } = await setup();
    await driver.setOutput('fan', 70);
    await driver.setOutput('heater', 60);
    expect(inner.sent).toEqual([
      ['fan', 70],
      ['heater', 60],
    ]);
  });

  it('holds a lower fan at the minimum while the heater is on', async () => {
    const { inner, driver } = await setup();
    await driver.setOutput('heater', 60);
    inner.sent.length = 0;
    expect((await driver.setOutput('fan', 10)).ok).toBe(true);
    expect(inner.sent).toEqual([['fan', 40]]);
  });

  it('lets the fan go below the minimum once the heater is off', async () => {
    const { inner, driver } = await setup();
    await driver.setOutput('heater', 60);
    await driver.setOutput('heater', 0);
    inner.sent.length = 0;
    await driver.setOutput('fan', 0);
    expect(inner.sent).toEqual([['fan', 0]]);
  });

  it('keeps the heater off when the fan does not take the minimum', async () => {
    const { inner, driver } = await setup();
    inner.failing.add('fan');
    expect(await driver.setOutput('heater', 60)).toEqual(err({ kind: 'disconnected' }));
    expect(inner.sent).toEqual([]);
  });

  it('logs once per hold, not on every command', async () => {
    const { driver, events } = await setup();
    await driver.setOutput('heater', 60);
    await driver.setOutput('fan', 10);
    await driver.setOutput('fan', 20);
    await driver.setOutput('heater', 0);
    await driver.setOutput('fan', 0);
    await driver.setOutput('heater', 50);
    expect(events()).toEqual(['safety.fan-held-for-heater', 'safety.fan-held-for-heater']);
  });

  it('assumes the board off after a reconnect, so the next heater command raises the fan', async () => {
    const { inner, driver } = await setup();
    await driver.setOutput('fan', 70);
    await driver.connect();
    inner.sent.length = 0;
    await driver.setOutput('heater', 60);
    expect(inner.sent).toEqual([
      ['fan', 40],
      ['heater', 60],
    ]);
  });

  it('passes safe stop and other outputs straight through', async () => {
    const { inner, driver } = await setup();
    await driver.setOutput('drum', 1);
    await driver.safeStop();
    expect(inner.sent).toEqual([['drum', 1]]);
    expect(inner.safeStops).toBe(1);
  });
});
