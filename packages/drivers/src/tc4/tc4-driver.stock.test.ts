import { createLogger, ManualClock } from '@roastpilot/core';
import { DEFAULT_TC4_WIRING, err, type LogEntry, type Tc4Wiring } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { FakeTransport } from './fake-transport';
import { stockTc4Dialect, TC4_BOOT_MS } from './stock-tc4-dialect';
import { Tc4Driver } from './tc4-driver';

/** TC1–TC4 as the board reads them: ET probe on TC1, bean probe on TC2 by default. */
const INPUTS = [212.4, 165.2, 21.9, 22.1];

/**
 * Answers like aArtisanQ_PID (docs/spec/hardware.md): it boots mapping TC2, TC1 in °F, `CHAN`
 * always acknowledges with a `#` line, `READ` prints ambient, the active channels in `CHAN` order,
 * heater, fan and the setpoint. Lines sent before it has booted are lost.
 */
function firmware(state = { heater: 0, fan: 0, booted: true }) {
  let chan = '2100';
  let celsius = false;
  return (line: string): string | undefined => {
    if (!state.booted) return undefined;
    if (line.startsWith('CHAN;')) {
      chan = line.slice(5);
      return `# Active channels set to ${chan}`;
    }
    if (line === 'UNITS;C') celsius = true;
    if (line.startsWith('OT1;')) state.heater = Number(line.slice(4));
    if (line.startsWith('OT2;') || line.startsWith('IO3;')) state.fan = Number(line.slice(4));
    if (line !== 'READ') return undefined;
    const temps = (chan.match(/\d/g) ?? [])
      .map(Number)
      .filter((input) => input > 0)
      .map((input) => INPUTS[input - 1] ?? 0)
      .map((c) => (celsius ? c : c * 1.8 + 32));
    return ['23.4', ...temps.map(String), String(state.heater), String(state.fan), '0'].join(',');
  };
}

function setup(wiring: Tc4Wiring = DEFAULT_TC4_WIRING, reply = firmware()) {
  const clock = new ManualClock();
  const transport = new FakeTransport(clock);
  transport.reply = reply;
  const entries: LogEntry[] = [];
  const driver = new Tc4Driver({
    dialect: stockTc4Dialect(wiring),
    transport,
    clock,
    logger: createLogger({ write: (e) => entries.push(e) }, 'driver'),
  });
  async function run<T>(call: Promise<T>): Promise<T> {
    await clock.runFor(10_000);
    return call;
  }
  return { clock, transport, driver, run, entries };
}

async function connected(wiring?: Tc4Wiring, reply?: (line: string) => string | undefined) {
  const ctx = setup(wiring, reply);
  expect(await ctx.run(ctx.driver.connect())).toEqual({ ok: true, value: undefined });
  ctx.transport.sent.length = 0;
  return ctx;
}

describe('Tc4Driver with the stock TC4 dialect', () => {
  describe('connect', () => {
    it('waits for the board, maps ET and BT, switches every output off and to °C, then reads', async () => {
      const { transport, driver, run } = setup();
      await run(driver.connect());
      expect(transport.sentLines()).toEqual([
        'CHAN;1200',
        'OT1;0',
        'OT2;0',
        'IO3;0',
        'UNITS;C',
        'READ',
        'READ',
      ]);
      expect(transport.sent[0]?.atMs).toBeGreaterThanOrEqual(TC4_BOOT_MS);
    });

    it('sends CHAN again until the board acknowledges it, so its boot mapping never stays', async () => {
      const state = { heater: 0, fan: 0, booted: false };
      const { clock, driver, run } = setup(DEFAULT_TC4_WIRING, firmware(state));
      const connecting = driver.connect();
      // Still starting when the first CHAN goes out; up before the second.
      await clock.runFor(TC4_BOOT_MS + 1000);
      state.booted = true;
      expect(await run(connecting)).toEqual({ ok: true, value: undefined });
      const reading = await run(driver.read());
      // BT from TC2 and ET from TC1, in °C: not the boot mapping in °F.
      expect(reading.ok && reading.value.values).toMatchObject({ bt: 165.2, et: 212.4 });
    });

    it('refuses a board that never acknowledges CHAN', async () => {
      const { transport, driver, run } = setup(DEFAULT_TC4_WIRING, () => undefined);
      expect(await run(driver.connect())).toEqual(err({ kind: 'no-reply', command: 'CHAN;1200' }));
      expect(transport.sentLines()).toEqual(['CHAN;1200', 'CHAN;1200', 'CHAN;1200']);
    });

    it('maps the inputs from the wiring, with no ET as channel 0', async () => {
      const { transport, driver, run } = setup({ ...DEFAULT_TC4_WIRING, btInput: 3, etInput: 0 });
      await run(driver.connect());
      expect(transport.sentLines()[0]).toBe('CHAN;0300');
    });

    it('refuses a board that acknowledges CHAN but never answers READ', async () => {
      const answer = firmware();
      const { driver, run } = setup(DEFAULT_TC4_WIRING, (line) =>
        line === 'READ' ? undefined : answer(line),
      );
      expect(await run(driver.connect())).toEqual(err({ kind: 'no-reply', command: 'READ' }));
    });

    it('stops at a CHAN that cannot be written', async () => {
      const { transport, driver, run } = setup();
      transport.failWrite = (line) => line.startsWith('CHAN;');
      expect(await run(driver.connect())).toEqual(err({ kind: 'disconnected' }));
    });

    it('refuses a reply that is not a TC4 status line', async () => {
      const answer = firmware();
      const { driver, run } = setup(DEFAULT_TC4_WIRING, (line) =>
        line === 'READ' ? 'hello,world' : answer(line),
      );
      expect(await run(driver.connect())).toEqual(err({ kind: 'bad-reply', line: 'hello,world' }));
    });
  });

  describe('read', () => {
    it('reads BT and ET by the wiring, and heater and fan from the echo', async () => {
      const { driver, run } = await connected();
      const reading = await run(driver.read());
      expect(reading.ok && reading.value.values).toEqual({
        bt: 165.2,
        et: 212.4,
        heater: 0,
        fan: 0,
      });
    });

    it('reads only BT when the roaster has no ET probe', async () => {
      const { driver, run } = await connected({ ...DEFAULT_TC4_WIRING, etInput: 0 });
      const reading = await run(driver.read());
      expect(reading.ok && reading.value.values).toEqual({ bt: 165.2, heater: 0, fan: 0 });
    });

    it.each([
      ['an empty BT field', '23.4,212.4,,0,0,0'],
      ['a field that is not a number', '23.4,212.4,abc,0,0,0'],
      ['too few fields', '23.4,212.4,165.2,0'],
    ])('reports a bad reply for %s', async (_case, line) => {
      const { transport, driver, run } = await connected();
      transport.reply = (sent) => (sent === 'READ' ? line : undefined);
      expect(await run(driver.read())).toEqual(err({ kind: 'bad-reply', line }));
    });

    it('never takes an acknowledgement as the READ reply', async () => {
      const { transport, driver, run } = await connected();
      transport.reply = (line) => (line === 'READ' ? '# OT1 level set to 50' : undefined);
      expect(await run(driver.read())).toEqual(err({ kind: 'no-reply', command: 'READ' }));
    });

    it('declares its channels from the wiring: no ET card without an ET probe', () => {
      const ids = (wiring: Tc4Wiring) => stockTc4Dialect(wiring).channels.map((c) => c.id);
      expect(ids(DEFAULT_TC4_WIRING)).toEqual(['bt', 'et', 'heater', 'fan']);
      expect(ids({ ...DEFAULT_TC4_WIRING, etInput: 0 })).toEqual(['bt', 'heater', 'fan']);
    });
  });

  describe('setOutput', () => {
    it.each([
      [DEFAULT_TC4_WIRING, 'heater', 43, 'OT1;45'],
      [DEFAULT_TC4_WIRING, 'fan', 60, 'OT2;60'],
      [{ ...DEFAULT_TC4_WIRING, fanOutput: 'IO3' } as const, 'fan', 60, 'IO3;60'],
      [{ ...DEFAULT_TC4_WIRING, heaterOutput: 'IO3' } as const, 'heater', 50, 'IO3;50'],
    ])('drives the wired output', async (wiring, channel, value, line) => {
      const { transport, driver, run } = await connected(wiring);
      await run(driver.setOutput(channel, value));
      expect(transport.sentLines()).toEqual([line]);
    });

    it('has no cooler, drum or filter to drive', async () => {
      const { transport, driver, run } = await connected();
      expect(await run(driver.setOutput('cooling', 100))).toEqual(
        err({ kind: 'unknown-channel', channel: 'cooling' }),
      );
      expect(transport.sent).toEqual([]);
    });
  });

  describe('safeStop', () => {
    it('sends heater 0, then fan 100', async () => {
      const { transport, driver, run } = await connected();
      await run(driver.safeStop());
      expect(transport.sentLines()).toEqual(['OT1;0', 'OT2;100']);
    });

    it('falls back to IO3;0, never PID;STOP, for a heater on IO3', async () => {
      const { transport, driver, run } = await connected({
        ...DEFAULT_TC4_WIRING,
        heaterOutput: 'IO3',
      });
      transport.failWrite = (line) => line === 'OT2;100';
      await run(driver.safeStop());
      expect(transport.sentLines()).toEqual(['IO3;0', 'IO3;0']);
    });

    it('falls back to PID;STOP when a step fails', async () => {
      const { transport, driver, run, entries } = await connected();
      transport.failWrite = (line) => line === 'OT1;0';
      await run(driver.safeStop());
      expect(transport.sentLines()).toEqual(['OT2;100', 'PID;STOP']);
      expect(entries.map((e) => e.event)).toContain('driver.safe-stop-incomplete');
    });
  });

  describe('readInputs', () => {
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
  });
});
