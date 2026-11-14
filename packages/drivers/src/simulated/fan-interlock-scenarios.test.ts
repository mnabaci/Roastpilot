import {
  FanInterlockDriver,
  ManualClock,
  SafetyGuardedDriver,
  SafetyMonitor,
  silentLogger,
  type SafetyEvent,
} from '@roastpilot/core';
import { describe, expect, it } from 'vitest';
import { SimulatedDriver } from './simulated-driver';

const MIN_FAN = 40;

/**
 * An air roaster as the app wires one with "Minimum fan while heating" (docs/spec/safety.md): the
 * safety guard in front of the interlock in front of the roaster. Every second it checks what the
 * roaster really runs: never heat with the fan under the minimum.
 */
async function airRoaster() {
  const clock = new ManualClock();
  const sim = new SimulatedDriver({ clock });
  const events: SafetyEvent[] = [];
  const interlock = new FanInterlockDriver(sim, MIN_FAN, silentLogger);
  // A trip's safe stop goes through the interlock, in line with every other command.
  const monitor = new SafetyMonitor({
    clock,
    safeStop: () => interlock.safeStop(),
    onEvent: (e) => events.push(e),
  });
  const driver = new SafetyGuardedDriver(interlock, monitor);
  expect((await driver.connect()).ok).toBe(true);
  const unsafe: string[] = [];

  /** Polls READ and runs the safety timer every second, checking the roaster's own outputs. */
  async function run(seconds: number): Promise<number> {
    let bt = Number.NaN;
    for (let s = 0; s < seconds; s++) {
      clock.advance(1000);
      const reading = await driver.read();
      if (reading.ok) {
        const { heater = 0, fan = 0 } = reading.value.values;
        bt = reading.value.values.bt ?? Number.NaN;
        if (heater > 0 && fan < MIN_FAN)
          unsafe.push(`${String(clock.now())}: ${String(heater)}/${String(fan)}`);
      }
      monitor.check();
    }
    return bt;
  }
  const tripped = () => events.filter((e) => e.kind === 'tripped').map((e) => e.rule);
  return { sim, monitor, driver, run, unsafe, tripped };
}

describe('air roaster scenarios: minimum fan while heating', () => {
  it('a whole manual roast with the fan pulled low never heats under the minimum', async () => {
    const r = await airRoaster();
    // Preheat asked with the fan off: the fan comes up first.
    await r.driver.setOutput('heater', 80);
    await r.run(240);
    r.sim.chargeBeans();
    r.monitor.roastStarted();
    // The roaster drags the fan down mid-roast, twice, and back up.
    for (const fan of [20, 0, 60, 10]) {
      await r.driver.setOutput('fan', fan);
      await r.run(90);
    }
    // Heater and fan changed at the same moment, as Auto and a hand can.
    await Promise.all([r.driver.setOutput('fan', 5), r.driver.setOutput('heater', 90)]);
    await r.run(60);
    await r.driver.setOutput('heater', 0);
    r.sim.dumpBeans();
    r.monitor.roastEnded();
    await r.driver.setOutput('fan', 0);
    await r.run(30);
    expect(r.unsafe).toEqual([]);
  });

  it('a runaway heater still trips at the limit, and the safe stop wins over the minimum', async () => {
    const r = await airRoaster();
    await r.driver.setOutput('fan', MIN_FAN);
    await r.driver.setOutput('heater', 100);
    await r.run(900);
    expect(r.tripped()).toEqual(['max-temperature']);
    const reading = await r.sim.read();
    expect(reading.ok && reading.value.values).toMatchObject({ heater: 0, fan: 100 });
    expect(r.unsafe).toEqual([]);
  });
});
