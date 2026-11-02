import { err, ok, type Channel, type Reading, type Result } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../clock';
import type { DriverError, RoasterDriver } from '../roaster-driver';
import { SafetyGuardedDriver } from './safety-guarded-driver';
import { SafetyMonitor } from './safety-monitor';

/** Records what reaches the roaster; readings come from `bt`. */
class RecordingDriver implements RoasterDriver {
  readonly channels: readonly Channel[] = [];
  readonly sent: [string, number][] = [];
  safeStops = 0;
  bt = 25;
  readonly clock: ManualClock;
  constructor(clock: ManualClock) {
    this.clock = clock;
  }
  connect(): Promise<Result<void, DriverError>> {
    return Promise.resolve(ok(undefined));
  }
  read(): Promise<Result<Reading, DriverError>> {
    return Promise.resolve(ok({ atMs: this.clock.now(), values: { bt: this.bt, heater: 0 } }));
  }
  setOutput(channel: string, value: number): Promise<Result<void, DriverError>> {
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

async function setup() {
  const clock = new ManualClock();
  const inner = new RecordingDriver(clock);
  const monitor = new SafetyMonitor({
    clock,
    safeStop: () => inner.safeStop(),
    onEvent: () => undefined,
  });
  const driver = new SafetyGuardedDriver(inner, monitor);
  await driver.connect();
  return { clock, inner, monitor, driver };
}

describe('SafetyGuardedDriver', () => {
  it('passes outputs through while unlocked', async () => {
    const { inner, driver } = await setup();
    expect((await driver.setOutput('heater', 80)).ok).toBe(true);
    expect(inner.sent).toEqual([['heater', 80]]);
  });

  it('feeds every reading to the monitor, which trips and safe-stops', async () => {
    const { inner, monitor, driver } = await setup();
    inner.bt = 250;
    await driver.read();
    expect(monitor.tripped).toEqual(['max-temperature']);
    expect(inner.safeStops).toBe(1);
  });

  it('refuses heater above 0 while locked, but lets heater 0 and other outputs through', async () => {
    const { inner, driver } = await setup();
    inner.bt = 250;
    await driver.read();
    expect(await driver.setOutput('heater', 5)).toEqual(
      err({ kind: 'safety-locked', channel: 'heater' }),
    );
    expect((await driver.setOutput('heater', 0)).ok).toBe(true);
    expect((await driver.setOutput('fan', 40)).ok).toBe(true);
    expect(inner.sent).toEqual([
      ['heater', 0],
      ['fan', 40],
    ]);
  });

  it('allows the heater again after the condition clears and you acknowledge', async () => {
    const { inner, monitor, driver } = await setup();
    inner.bt = 250;
    await driver.read();
    inner.bt = 200;
    await driver.read();
    expect(monitor.acknowledge().ok).toBe(true);
    expect((await driver.setOutput('heater', 60)).ok).toBe(true);
  });

  it('arms lost connection on connect', async () => {
    const { clock, monitor } = await setup();
    clock.advance(3000);
    monitor.check();
    expect(monitor.tripped).toEqual(['lost-connection']);
  });
});
