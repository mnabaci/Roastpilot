import { describe, expect, it } from 'vitest';
import { connected, pollFor, readValues } from './simulated-driver-fixture';

describe('SimulatedDriver ET', () => {
  it('leads BT when the heater comes on', async () => {
    const { clock, driver } = await connected();
    await driver.setOutput('heater', 100);
    await pollFor(clock, driver, 10);
    const values = await readValues(driver);
    expect((values.et ?? 0) - (values.bt ?? 0)).toBeGreaterThan(10);
  });

  it('reads above BT through a whole preheat climb', async () => {
    const { clock, driver } = await connected();
    await driver.setOutput('heater', 80);
    await driver.setOutput('fan', 30);
    for (let s = 1; s <= 420; s++) {
      clock.advance(1000);
      const values = await readValues(driver);
      if (s > 30) expect(values.et ?? 0).toBeGreaterThan(values.bt ?? 0);
    }
  });

  it('dips far less than BT at charge, through the turning point', async () => {
    const { clock, driver } = await connected();
    await driver.setOutput('heater', 60);
    await driver.setOutput('fan', 30);
    await pollFor(clock, driver, 900);
    const before = await readValues(driver);
    driver.chargeBeans();
    let lowBt = Infinity;
    let lowEt = Infinity;
    for (let s = 0; s < 120; s++) {
      clock.advance(1000);
      const values = await readValues(driver);
      lowBt = Math.min(lowBt, values.bt ?? Infinity);
      lowEt = Math.min(lowEt, values.et ?? Infinity);
    }
    const btDip = (before.bt ?? 0) - lowBt;
    const etDip = (before.et ?? 0) - lowEt;
    expect(btDip).toBeGreaterThan(50);
    expect(etDip).toBeLessThan(btDip / 2);
  });
});
