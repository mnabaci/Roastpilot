import {
  ManualClock,
  SafetyGuardedDriver,
  SafetyMonitor,
  type SafetyEvent,
} from '@roastpilot/core';
import { describe, expect, it } from 'vitest';
import { SimulatedDriver } from './simulated-driver';

/** The app's wiring: the guard is the only driver anyone talks to. */
async function roaster() {
  const clock = new ManualClock();
  const sim = new SimulatedDriver({ clock });
  const events: SafetyEvent[] = [];
  const monitor = new SafetyMonitor({
    clock,
    safeStop: () => sim.safeStop(),
    onEvent: (e) => events.push(e),
  });
  const driver = new SafetyGuardedDriver(sim, monitor);
  expect((await driver.connect()).ok).toBe(true);

  /** Polls READ and runs the 1 s safety timer, like the app. Returns the last temperature. */
  async function run(seconds: number): Promise<number> {
    let bt = Number.NaN;
    for (let i = 0; i < seconds; i++) {
      clock.advance(1000);
      const reading = await driver.read();
      if (reading.ok) bt = reading.value.values.bt ?? Number.NaN;
      monitor.check();
    }
    return bt;
  }

  async function outputs() {
    const reading = await sim.read();
    return reading.ok ? reading.value.values : {};
  }

  const tripped = () => events.filter((e) => e.kind === 'tripped').map((e) => e.rule);
  return { clock, sim, monitor, driver, events, run, outputs, tripped };
}

describe('safety scenarios on the simulated Skywalker', () => {
  it('a runaway heater trips at 240 °C, safe-stops and stays locked', async () => {
    const { monitor, driver, run, outputs, tripped } = await roaster();
    await driver.setOutput('heater', 100);
    await run(600);
    expect(tripped()).toEqual(['max-temperature']);
    expect(await outputs()).toMatchObject({ heater: 0, fan: 100 });
    expect(await driver.setOutput('heater', 100)).toEqual({
      ok: false,
      error: { kind: 'safety-locked', channel: 'heater' },
    });
    expect(monitor.locked).toBe(true);
  });

  it('refuses to unlock while still over the limit, then unlocks once it has cooled', async () => {
    const { monitor, driver, run } = await roaster();
    await driver.setOutput('heater', 100);
    for (let s = 0; s < 600 && monitor.tripped.length === 0; s++) await run(1);
    expect(monitor.acknowledge()).toMatchObject({ ok: false, error: { kind: 'still-tripped' } });
    expect(await run(120)).toBeLessThan(240);
    expect(monitor.acknowledge().ok).toBe(true);
    expect((await driver.setOutput('heater', 50)).ok).toBe(true);
  });

  it('a pulled cable trips lost connection and safe-stops again on reconnect', async () => {
    const { sim, driver, run, outputs, tripped } = await roaster();
    await driver.setOutput('heater', 60);
    await run(30);
    sim.unplug();
    await run(3);
    expect(tripped()).toEqual(['lost-connection']);

    sim.plugIn();
    expect((await driver.connect()).ok).toBe(true);
    // Reconnecting resets every output, so prove the second safe stop by setting a value first.
    await sim.setOutput('heater', 60);
    await run(1);
    expect(await outputs()).toMatchObject({ heater: 0, fan: 100 });
  });

  it('a stalled sensor alarms without locking: you decide', async () => {
    const { sim, monitor, driver, run, events } = await roaster();
    await driver.setOutput('heater', 40);
    await run(5);
    sim.stallTemperature(true);
    await run(12);
    expect(events.filter((e) => e.kind === 'tripped')).toEqual([
      expect.objectContaining({ rule: 'frozen-reading', action: 'alarm' }),
    ]);
    expect(monitor.locked).toBe(false);
    expect((await driver.setOutput('heater', 40)).ok).toBe(true);
  });

  it('an idle roaster at a steady temperature raises nothing', async () => {
    const { run, events } = await roaster();
    await run(300);
    expect(events).toEqual([]);
  });

  it('a roast past 20 minutes trips max roast time', async () => {
    const { monitor, driver, run, tripped } = await roaster();
    monitor.roastStarted();
    await driver.setOutput('heater', 30);
    await driver.setOutput('fan', 100);
    await run(20 * 60);
    expect(tripped()).toContain('max-roast-time');
    expect(tripped()).not.toContain('max-temperature');
  });
});
