import { ManualClock } from '@roastpilot/core';
import type { Reading } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { SimulatedDriver, type SimulatedDriverOptions } from './simulated-driver';

async function connected(options: Partial<SimulatedDriverOptions> = {}) {
  const clock = new ManualClock();
  const driver = new SimulatedDriver({ clock, ...options });
  expect(await driver.connect()).toEqual({ ok: true, value: undefined });
  return { clock, driver };
}

async function readValues(driver: SimulatedDriver): Promise<Reading['values']> {
  const result = await driver.read();
  if (!result.ok) throw new Error(`read failed: ${result.error.kind}`);
  return result.value.values;
}

/** Polls READ every second like the app, which also keeps the watchdog fed. */
async function pollFor(
  clock: ManualClock,
  driver: SimulatedDriver,
  seconds: number,
): Promise<number> {
  let bt = Number.NaN;
  for (let i = 0; i < seconds; i++) {
    clock.advance(1000);
    bt = (await readValues(driver)).bt ?? Number.NaN;
  }
  return bt;
}

describe('SimulatedDriver', () => {
  it('declares the Skywalker channels', () => {
    const driver = new SimulatedDriver({ clock: new ManualClock() });
    expect(driver.channels.map((c) => c.id)).toEqual([
      'bt',
      'heater',
      'fan',
      'cooling',
      'filter',
      'drum',
    ]);
  });

  it('starts at ambient with outputs off', async () => {
    const { driver } = await connected();
    expect(await readValues(driver)).toEqual({
      bt: 22,
      heater: 0,
      fan: 0,
      cooling: 0,
      filter: 0,
      drum: 0,
    });
  });

  it('stamps readings with the clock time', async () => {
    const { clock, driver } = await connected();
    clock.advance(1500);
    const result = await driver.read();
    expect(result.ok && result.value.atMs).toBe(1500);
  });

  it('heats with the heater on and echoes heater and fan', async () => {
    const { clock, driver } = await connected();
    await driver.setOutput('heater', 100);
    await driver.setOutput('fan', 40);
    const bt = await pollFor(clock, driver, 60);
    // Like the real roaster: about 0.5 °C a second from cold at heater 100.
    expect(bt).toBeGreaterThan(45);
    expect(await readValues(driver)).toMatchObject({ heater: 100, fan: 40 });
  });

  it('rounds and clamps outputs to the channel step', async () => {
    const { driver } = await connected();
    await driver.setOutput('heater', 43);
    await driver.setOutput('fan', 150);
    expect(await readValues(driver)).toMatchObject({ heater: 45, fan: 100 });
  });

  it('rejects unknown channels and sensor channels', async () => {
    const { driver } = await connected();
    expect(await driver.setOutput('boost', 50)).toEqual({
      ok: false,
      error: { kind: 'unknown-channel', channel: 'boost' },
    });
    expect(await driver.setOutput('bt', 50)).toEqual({
      ok: false,
      error: { kind: 'unknown-channel', channel: 'bt' },
    });
  });

  it('gives the same readings for the same inputs', async () => {
    const runOnce = async () => {
      const { clock, driver } = await connected();
      await driver.setOutput('heater', 70);
      return pollFor(clock, driver, 120);
    };
    expect(await runOnce()).toBe(await runOnce());
  });

  describe('safe stop', () => {
    it('sets heater 0, fan 100 and cooling 100, and the temperature falls', async () => {
      const { clock, driver } = await connected();
      await driver.setOutput('heater', 100);
      const hot = await pollFor(clock, driver, 120);
      await driver.safeStop();
      expect(await readValues(driver)).toMatchObject({ heater: 0, fan: 100 });
      expect(await pollFor(clock, driver, 30)).toBeLessThan(hot);
    });

    it('resolves without throwing when unplugged', async () => {
      const { driver } = await connected();
      driver.unplug();
      await expect(driver.safeStop()).resolves.toBeUndefined();
    });
  });

  describe('sketch behaviour', () => {
    it('switches everything off after 10 s without a command', async () => {
      const { clock, driver } = await connected();
      await driver.setOutput('heater', 80);
      clock.advance(10_100);
      expect(await readValues(driver)).toMatchObject({ heater: 0, fan: 0 });
    });

    it('keeps outputs on while READ is polled every second', async () => {
      const { clock, driver } = await connected();
      await driver.setOutput('heater', 80);
      await pollFor(clock, driver, 30);
      expect(await readValues(driver)).toMatchObject({ heater: 80 });
    });

    it('runs ESTOP above 300 °C', async () => {
      const { clock, driver } = await connected({ constants: { heatGainCPerS: 20 } });
      await driver.setOutput('heater', 100);
      await pollFor(clock, driver, 30);
      expect(await readValues(driver)).toMatchObject({ heater: 0, fan: 100 });
    });
  });

  describe('faults', () => {
    it('reports a version mismatch on connect', async () => {
      const driver = new SimulatedDriver({ clock: new ManualClock(), protocolVersion: 2 });
      expect(await driver.connect()).toEqual({
        ok: false,
        error: { kind: 'version-mismatch', expected: 1, actual: 2 },
      });
      expect(await driver.read()).toEqual({ ok: false, error: { kind: 'disconnected' } });
    });

    it('refuses reads and writes before connect', async () => {
      const driver = new SimulatedDriver({ clock: new ManualClock() });
      expect(await driver.read()).toEqual({ ok: false, error: { kind: 'disconnected' } });
      expect(await driver.setOutput('heater', 50)).toEqual({
        ok: false,
        error: { kind: 'disconnected' },
      });
    });

    it('repeats the same temperature while stalled, then resumes', async () => {
      const { clock, driver } = await connected();
      await driver.setOutput('heater', 100);
      driver.stallTemperature(true);
      const first = await pollFor(clock, driver, 1);
      expect(await pollFor(clock, driver, 10)).toBe(first);
      driver.stallTemperature(false);
      expect(await pollFor(clock, driver, 1)).toBeGreaterThan(first);
    });

    it('keeps heating while unplugged until the watchdog trips, then reconnects', async () => {
      const { clock, driver } = await connected();
      await driver.setOutput('heater', 100);
      driver.unplug();
      clock.advance(5000);
      expect(await driver.read()).toEqual({ ok: false, error: { kind: 'disconnected' } });
      expect(await driver.connect()).toEqual({ ok: false, error: { kind: 'disconnected' } });

      clock.advance(10_000);
      driver.plugIn();
      expect(await driver.read()).toEqual({ ok: false, error: { kind: 'disconnected' } });
      await driver.connect();
      const values = await readValues(driver);
      expect(values).toMatchObject({ heater: 0 });
      expect(values.bt).toBeGreaterThan(22);
    });
  });

  it('refuses calls after disconnect until connect, and keeps running the roaster', async () => {
    const { clock, driver } = await connected();
    await driver.setOutput('heater', 100);
    await driver.disconnect();
    expect(await driver.read()).toEqual({ ok: false, error: { kind: 'disconnected' } });
    clock.advance(5000);
    await driver.connect();
    expect((await readValues(driver)).bt).toBeGreaterThan(22);
  });
});
