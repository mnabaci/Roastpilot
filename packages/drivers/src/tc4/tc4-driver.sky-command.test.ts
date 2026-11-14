import { err } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { connected, READ_REPLY, setup, sketch } from './sky-command-fixture';

describe('Tc4Driver with the SkyCommand dialect: connect and read', () => {
  describe('connect', () => {
    it('switches to °C, checks the version, then takes a reading', async () => {
      const { transport, driver, run } = setup();
      expect((await run(driver.connect())).ok).toBe(true);
      expect(transport.sentLines()).toEqual(['UNITS;C', 'VERSION', 'READ']);
    });

    it('refuses another protocol version and closes the port', async () => {
      const { transport, driver, run } = setup(sketch('2'));
      expect(await run(driver.connect())).toEqual(
        err({ kind: 'version-mismatch', expected: 1, actual: 2 }),
      );
      expect(await run(driver.read())).toEqual(err({ kind: 'disconnected' }));
      expect(await transport.write('READ')).toMatchObject({ ok: false });
    });

    it('treats a sketch that does not answer VERSION as too old', async () => {
      const { driver, run } = setup((line) => (line === 'READ' ? READ_REPLY : undefined));
      expect(await run(driver.connect())).toEqual(
        err({ kind: 'version-mismatch', expected: 1, actual: null }),
      );
    });

    it('fails when the version reply is garbage', async () => {
      const { driver, run } = setup(sketch('hello'));
      expect(await run(driver.connect())).toEqual(err({ kind: 'bad-reply', line: 'hello' }));
    });

    it('fails when the port cannot open', async () => {
      const { transport, driver, run } = setup();
      transport.openResult = err({ kind: 'disconnected', message: 'busy' });
      expect(await run(driver.connect())).toEqual(err({ kind: 'disconnected' }));
    });
  });

  describe('read', () => {
    it('returns temperature, heater and fan stamped with the clock', async () => {
      const { clock, driver, run } = await connected();
      clock.advance(1000);
      const startedAt = clock.now();
      expect(await run(driver.read())).toEqual({
        ok: true,
        value: {
          atMs: startedAt,
          values: { bt: 42.39, heater: 30, fan: 0, cooling: 0, filter: 0, drum: 0 },
        },
      });
    });

    it('fills in the outputs READ does not report from what was last sent', async () => {
      const { driver, run } = await connected();
      await run(driver.setOutput('cooling', 100));
      await run(driver.setOutput('drum', 1));
      const reading = await run(driver.read());
      // Heater and fan still come from the reply (30 and 0 in the bench line), not from what was sent.
      expect(reading.ok && reading.value.values).toEqual({
        bt: 42.39,
        heater: 30,
        fan: 0,
        cooling: 100,
        filter: 0,
        drum: 1,
      });
    });

    it('logs once when the board reports a heater or fan we did not send, and once when it matches again', async () => {
      let line = '0.00,40.00,40.00,30,60,0';
      const { driver, run, entries } = await connected((command) =>
        command === 'VERSION' ? '1' : command === 'READ' ? line : undefined,
      );
      await run(driver.setOutput('heater', 30));
      await run(driver.setOutput('fan', 60));
      await run(driver.read());
      expect(entries).toEqual([]);
      line = '0.00,40.00,40.00,30,100,0';
      await run(driver.read());
      await run(driver.read());
      line = '0.00,40.00,40.00,30,60,0';
      await run(driver.read());
      expect(entries.map((e) => [e.event, e.context])).toEqual([
        [
          'driver.output-changed-by-board',
          { channel: 'fan', sent: 60, reported: 100, line: '0.00,40.00,40.00,30,100,0' },
        ],
        ['driver.output-matches-again', { channel: 'fan', value: 60 }],
      ]);
    });

    it('reports a bad reply without throwing', async () => {
      const { transport, driver, run } = await connected();
      transport.reply = () => '0.00,garbage';
      expect(await run(driver.read())).toEqual(err({ kind: 'bad-reply', line: '0.00,garbage' }));
    });

    it('does not take a line with no commas as the READ reply', async () => {
      const { transport, driver, run } = await connected();
      transport.reply = () => '1';
      expect(await run(driver.read())).toEqual(err({ kind: 'no-reply', command: 'READ' }));
    });

    it('reports no reply after the timeout', async () => {
      const { transport, driver, run } = await connected();
      transport.reply = () => undefined;
      expect(await run(driver.read())).toEqual(err({ kind: 'no-reply', command: 'READ' }));
    });

    it('reports disconnected once the cable is pulled, until connect succeeds again', async () => {
      const { transport, driver, run } = await connected();
      transport.drop();
      expect(await run(driver.read())).toEqual(err({ kind: 'disconnected' }));
      expect((await run(driver.connect())).ok).toBe(true);
      expect((await run(driver.read())).ok).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('closes the port and refuses calls until connect', async () => {
      const { transport, driver, run } = await connected();
      await run(driver.disconnect());
      expect(await transport.write('READ')).toMatchObject({ ok: false });
      expect(await run(driver.read())).toEqual(err({ kind: 'disconnected' }));
      expect((await run(driver.connect())).ok).toBe(true);
    });
  });
});
