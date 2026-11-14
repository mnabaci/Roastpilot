import { ManualClock } from '@roastpilot/core';
import type { Reading } from '@roastpilot/shared';
import { expect } from 'vitest';
import { SimulatedDriver, type SimulatedDriverOptions } from './simulated-driver';

/** A connected Simulator on fake time. */
export async function connected(options: Partial<SimulatedDriverOptions> = {}) {
  const clock = new ManualClock();
  const driver = new SimulatedDriver({ clock, ...options });
  expect(await driver.connect()).toEqual({ ok: true, value: undefined });
  return { clock, driver };
}

/** One reading's values; a failed read fails the test. */
export async function readValues(driver: SimulatedDriver): Promise<Reading['values']> {
  const result = await driver.read();
  if (!result.ok) throw new Error(`read failed: ${result.error.kind}`);
  return result.value.values;
}

/** Polls READ every second like the app, which also keeps the watchdog fed. */
export async function pollFor(
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
