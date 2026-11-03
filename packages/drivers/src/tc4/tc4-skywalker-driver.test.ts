import { createLogger, ManualClock } from '@roastpilot/core';
import { err, type LogEntry } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { COMMAND_GAP_MS } from './command-queue';
import { FakeTransport } from './fake-transport';
import { Tc4SkywalkerDriver } from './tc4-skywalker-driver';

const READ_REPLY = '0.00,42.39,42.39,30,0,0';

/** Answers like the real sketch, from the bench session on 2026-11-02. */
function sketch(version = '1') {
  return (line: string): string | undefined => {
    if (line === 'VERSION') return version;
    if (line === 'READ') return READ_REPLY;
    return undefined;
  };
}

function setup(reply = sketch()) {
  const clock = new ManualClock();
  const transport = new FakeTransport(clock);
  transport.reply = reply;
  const driver = new Tc4SkywalkerDriver({ transport, clock });
  /** Runs a driver call to completion on fake time. */
  async function run<T>(call: Promise<T>): Promise<T> {
    await clock.runFor(5000);
    return call;
  }
  return { clock, transport, driver, run };
}

async function connected(reply = sketch()) {
  const ctx = setup(reply);
  expect(await ctx.run(ctx.driver.connect())).toEqual({ ok: true, value: undefined });
  ctx.transport.sent.length = 0;
  return ctx;
}

describe('Tc4SkywalkerDriver', () => {
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

    it('reports a bad reply without throwing', async () => {
      const { transport, driver, run } = await connected();
      transport.reply = () => 'garbage';
      expect(await run(driver.read())).toEqual(err({ kind: 'bad-reply', line: 'garbage' }));
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

  describe('setOutput', () => {
    it.each([
      ['heater', 43, 'OT1;45'],
      ['fan', 150, 'OT2;100'],
      ['cooling', 100, 'COOL;100'],
      ['filter', 50, 'FILTER;50'],
      ['drum', 1, 'DRUM;1'],
      ['drum', 0, 'DRUM;0'],
    ])('sends %s %d as %s', async (channel, value, line) => {
      const { transport, driver, run } = await connected();
      expect((await run(driver.setOutput(channel, value))).ok).toBe(true);
      expect(transport.sentLines()).toEqual([line]);
    });

    it('rejects unknown channels and the sensor without sending anything', async () => {
      const { transport, driver, run } = await connected();
      expect(await run(driver.setOutput('boost', 50))).toEqual(
        err({ kind: 'unknown-channel', channel: 'boost' }),
      );
      expect(await run(driver.setOutput('bt', 50))).toEqual(
        err({ kind: 'unknown-channel', channel: 'bt' }),
      );
      expect(transport.sent).toEqual([]);
    });

    it('refuses before connect', async () => {
      const { transport, driver, run } = setup();
      expect(await run(driver.setOutput('heater', 50))).toEqual(err({ kind: 'disconnected' }));
      expect(transport.sent).toEqual([]);
    });
  });

  describe('safeStop', () => {
    it('sends heater 0, fan 100, cooling 100 in order, spaced by the gap', async () => {
      const { transport, driver, run } = await connected();
      await run(driver.safeStop());
      expect(transport.sentLines()).toEqual(['OT1;0', 'OT2;100', 'COOL;100']);
      const gaps = transport.sent.slice(1).map((s, i) => s.atMs - (transport.sent[i]?.atMs ?? 0));
      expect(gaps.every((gap) => gap >= COMMAND_GAP_MS)).toBe(true);
    });

    it('logs when the safe stop needed the ESTOP fallback', async () => {
      const entries: LogEntry[] = [];
      const clock = new ManualClock();
      const transport = new FakeTransport(clock);
      transport.reply = sketch();
      const driver = new Tc4SkywalkerDriver({
        transport,
        clock,
        logger: createLogger({ write: (e) => entries.push(e) }, 'driver'),
      });
      const done = driver.connect();
      await clock.runFor(5000);
      await done;
      transport.failWrite = (line) => line === 'OT1;0';
      const stop = driver.safeStop();
      await clock.runFor(5000);
      await stop;
      expect(entries.map((e) => e.event)).toEqual(['driver.safe-stop-incomplete']);
    });

    it('falls back to ESTOP when a safe-stop command fails', async () => {
      const { transport, driver, run } = await connected();
      transport.failWrite = (line) => line === 'OT2;100';
      await run(driver.safeStop());
      expect(transport.sentLines()).toEqual(['OT1;0', 'COOL;100', 'ESTOP']);
    });

    it('still tries when the driver thinks it is disconnected', async () => {
      const { transport, driver, run } = await connected();
      // A failed handshake leaves the driver disconnected but the port may still work.
      transport.reply = sketch('2');
      await run(driver.connect());
      await transport.open();
      transport.sent.length = 0;
      await run(driver.safeStop());
      expect(transport.sentLines()).toEqual(['OT1;0', 'OT2;100', 'COOL;100']);
    });

    it('resolves without throwing when the cable is pulled', async () => {
      const { transport, driver, run } = await connected();
      transport.drop();
      await expect(run(driver.safeStop())).resolves.toBeUndefined();
    });

    it('waits behind a pending read instead of merging with it', async () => {
      const { transport, driver, run } = await connected();
      const reading = driver.read();
      const stop = driver.safeStop();
      await run(Promise.all([reading, stop]));
      expect(transport.sentLines()).toEqual(['READ', 'OT1;0', 'OT2;100', 'COOL;100']);
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
