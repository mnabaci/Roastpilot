import { err } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { connected, firmware, INPUTS, setup } from './stock-tc4-fixture';

describe('Tc4Driver with the stock TC4 dialect: readInputs', () => {
  it('reads TC1–TC4, then puts the wiring back', async () => {
    const { transport, driver, run } = await connected();
    expect(await run(driver.readInputs())).toEqual({ ok: true, value: INPUTS });
    expect(transport.sentLines()).toEqual(['CHAN;1234', 'READ', 'CHAN;1200']);
  });

  it('never lets a poll read while the inputs are switched', async () => {
    const { transport, driver, run } = await connected();
    const probing = driver.readInputs();
    const polling = driver.read();
    const [, reading] = await run(Promise.all([probing, polling]));
    expect(transport.sentLines()).toEqual(['CHAN;1234', 'READ', 'CHAN;1200', 'READ']);
    expect(reading.ok && reading.value.values.bt).toBe(165.2);
  });

  it('puts the wiring back even when the probe gets no reply', async () => {
    const { transport, driver, run } = await connected();
    const answer = firmware();
    transport.reply = (line) => (line === 'READ' ? undefined : answer(line));
    expect(await run(driver.readInputs())).toEqual(err({ kind: 'no-reply', command: 'READ' }));
    expect(transport.sentLines()).toEqual(['CHAN;1234', 'READ', 'CHAN;1200']);
  });

  it('reports a bad reply when the probe line has the wrong number of fields', async () => {
    const { transport, driver, run } = await connected();
    const answer = firmware();
    transport.reply = (line) => (line === 'READ' ? '23.4,212.4,165.2,0,0,0' : answer(line));
    expect(await run(driver.readInputs())).toEqual(
      err({ kind: 'bad-reply', line: '23.4,212.4,165.2,0,0,0' }),
    );
  });

  it('says so when the wiring could not be put back', async () => {
    const { transport, driver, run } = await connected();
    transport.failWrite = (line) => line === 'CHAN;1200';
    expect(await run(driver.readInputs())).toEqual(err({ kind: 'disconnected' }));
  });

  it('never holds a safe stop back behind a probe', async () => {
    const { transport, driver, run } = await connected();
    const probing = driver.readInputs();
    const stopping = driver.safeStop();
    await run(Promise.all([probing, stopping]));
    const lines = transport.sentLines();
    expect(lines.indexOf('OT1;0')).toBeLessThan(lines.indexOf('CHAN;1200'));
  });

  it('refuses when not connected', async () => {
    const { driver, run } = setup();
    expect(await run(driver.readInputs())).toEqual(err({ kind: 'disconnected' }));
  });

  it('sends nothing more when switching to every input fails', async () => {
    const { transport, driver, run } = await connected();
    transport.failWrite = (line) => line === 'CHAN;1234';
    expect(await run(driver.readInputs())).toEqual(err({ kind: 'disconnected' }));
    expect(transport.sentLines()).toEqual([]);
  });
});
