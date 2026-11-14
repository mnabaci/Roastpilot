import { err } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { setup } from './fan-interlock-fixture';

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

  it('never ends with the heater on and the fan below the minimum, when two commands race', async () => {
    const { inner, driver } = await setup();
    await driver.setOutput('fan', 50);
    await Promise.all([driver.setOutput('fan', 10), driver.setOutput('heater', 80)]);
    const last = (channel: string) => inner.sent.filter(([c]) => c === channel).at(-1)?.[1];
    expect(last('heater')).toBe(80);
    expect(last('fan')).toBeGreaterThanOrEqual(40);
  });

  it('raises the fan for a heater that races a lower fan from a standstill', async () => {
    const { inner, driver } = await setup();
    await Promise.all([driver.setOutput('heater', 80), driver.setOutput('fan', 10)]);
    expect(inner.sent).toEqual([
      ['fan', 40],
      ['heater', 80],
      ['fan', 40],
    ]);
  });

  it('still holds the fan after a safe stop, as that may not have reached the board', async () => {
    const { inner, driver } = await setup();
    await driver.setOutput('heater', 60);
    await driver.safeStop();
    inner.sent.length = 0;
    await driver.setOutput('fan', 0);
    expect(inner.sent).toEqual([['fan', 40]]);
  });

  it('keeps a safe stop in line behind a heater command sent before it', async () => {
    const { inner, driver } = await setup();
    const order: string[] = [];
    const originalStop = inner.safeStop.bind(inner);
    inner.safeStop = () => {
      order.push('safe-stop');
      return originalStop();
    };
    const originalSet = inner.setOutput.bind(inner);
    inner.setOutput = (channel, value) => {
      order.push(`${channel}=${String(value)}`);
      return originalSet(channel, value);
    };
    await Promise.all([driver.setOutput('heater', 60), driver.safeStop()]);
    expect(order).toEqual(['fan=40', 'heater=60', 'safe-stop']);
  });

  it('passes safe stop and other outputs straight through', async () => {
    const { inner, driver } = await setup();
    await driver.setOutput('drum', 1);
    await driver.safeStop();
    expect(inner.sent).toEqual([['drum', 1]]);
    expect(inner.safeStops).toBe(1);
  });
});
