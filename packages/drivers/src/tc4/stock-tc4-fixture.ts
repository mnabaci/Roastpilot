import { createLogger, ManualClock } from '@roastpilot/core';
import { DEFAULT_TC4_WIRING, type LogEntry, type Tc4Wiring } from '@roastpilot/shared';
import { expect } from 'vitest';
import { FakeTransport } from './fake-transport';
import { stockTc4Dialect } from './stock-tc4-dialect';
import { Tc4Driver } from './tc4-driver';

/** TC1–TC4 as the board reads them: ET probe on TC1, bean probe on TC2 by default. */
export const INPUTS = [212.4, 165.2, 21.9, 22.1];

/**
 * Answers like aArtisanQ_PID (docs/spec/hardware.md): it boots mapping TC2, TC1 in °F, `CHAN`
 * always acknowledges with a `#` line, `READ` prints ambient, the active channels in `CHAN` order,
 * heater, fan and the setpoint. Lines sent before it has booted are lost.
 */
export function firmware(state = { heater: 0, fan: 0, booted: true }) {
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

/** A stock-firmware driver on a fake board and fake time, with every log entry kept. */
export function setup(wiring: Tc4Wiring = DEFAULT_TC4_WIRING, reply = firmware()) {
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

/** `setup`, connected, with what the handshake sent cleared. */
export async function connected(wiring?: Tc4Wiring, reply?: (line: string) => string | undefined) {
  const ctx = setup(wiring, reply);
  expect(await ctx.run(ctx.driver.connect())).toEqual({ ok: true, value: undefined });
  ctx.transport.sent.length = 0;
  return ctx;
}
