import { err } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { setup } from './fan-interlock-fixture';

/** What the board may be running after a command fails: always assumed the worse way. */
describe('FanInterlockDriver when commands fail', () => {
  it('resets only once a reconnect worked, after anything still in flight', async () => {
    const { inner, driver } = await setup();
    await driver.setOutput('fan', 70);
    const late = driver.setOutput('fan', 70);
    await Promise.all([late, driver.connect()]);
    inner.sent.length = 0;
    await driver.setOutput('heater', 60);
    expect(inner.sent).toEqual([
      ['fan', 40],
      ['heater', 60],
    ]);
  });

  it('counts a heater command that failed as maybe on: a lower fan is still held', async () => {
    const { inner, driver } = await setup();
    await driver.setOutput('fan', 50);
    inner.failing.add('heater');
    await driver.setOutput('heater', 80);
    inner.failing.delete('heater');
    inner.sent.length = 0;
    await driver.setOutput('fan', 0);
    expect(inner.sent).toEqual([['fan', 40]]);
  });

  it('counts a fan command that failed as maybe lower: the next heater command raises it', async () => {
    const { inner, driver } = await setup();
    await driver.setOutput('fan', 70);
    inner.failing.add('fan');
    await driver.setOutput('fan', 0);
    inner.failing.delete('fan');
    inner.sent.length = 0;
    await driver.setOutput('heater', 60);
    expect(inner.sent).toEqual([
      ['fan', 40],
      ['heater', 60],
    ]);
  });

  it('keeps the old state when a reconnect fails', async () => {
    const { inner, driver } = await setup();
    await driver.setOutput('heater', 60);
    inner.connectResult = err({ kind: 'disconnected' });
    await driver.connect();
    inner.sent.length = 0;
    await driver.setOutput('fan', 0);
    expect(inner.sent).toEqual([['fan', 40]]);
  });

  it('keeps holding the fan when a heater 0 fails: the heater may still be on', async () => {
    const { inner, driver } = await setup();
    await driver.setOutput('heater', 60);
    inner.failing.add('heater');
    await driver.setOutput('heater', 0);
    inner.failing.delete('heater');
    inner.sent.length = 0;
    await driver.setOutput('fan', 0);
    expect(inner.sent).toEqual([['fan', 40]]);
  });

  it('is not jammed by a command that throws: the next one still goes', async () => {
    const { inner, driver } = await setup();
    inner.throwing.add('fan');
    await expect(driver.setOutput('fan', 70)).rejects.toThrow('port gone');
    inner.sent.length = 0;
    expect((await driver.setOutput('heater', 60)).ok).toBe(true);
    expect(inner.sent).toEqual([
      ['fan', 40],
      ['heater', 60],
    ]);
  });
});
