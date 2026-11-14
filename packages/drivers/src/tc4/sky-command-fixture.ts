import { createLogger, ManualClock } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { expect } from 'vitest';
import { FakeTransport } from './fake-transport';
import { skyCommandDialect } from './sky-command-dialect';
import { Tc4Driver } from './tc4-driver';

/** The READ reply from the bench session on 2026-11-02: 42.39 °C, heater 30, fan 0. */
export const READ_REPLY = '0.00,42.39,42.39,30,0,0';

/** Answers like the real SkyCommand sketch. */
export function sketch(version = '1') {
  return (line: string): string | undefined => {
    if (line === 'VERSION') return version;
    if (line === 'READ') return READ_REPLY;
    return undefined;
  };
}

/** A SkyCommand driver on a fake board and fake time, with every log entry kept in `entries`. */
export function setup(reply = sketch()) {
  const clock = new ManualClock();
  const transport = new FakeTransport(clock);
  transport.reply = reply;
  const entries: LogEntry[] = [];
  const driver = new Tc4Driver({
    dialect: skyCommandDialect,
    transport,
    clock,
    logger: createLogger({ write: (e) => entries.push(e) }, 'driver'),
  });
  /** Runs a driver call to completion on fake time. */
  async function run<T>(call: Promise<T>): Promise<T> {
    await clock.runFor(5000);
    return call;
  }
  return { clock, transport, driver, run, entries };
}

/** `setup`, connected, with what the handshake sent cleared. */
export async function connected(reply = sketch()) {
  const ctx = setup(reply);
  expect(await ctx.run(ctx.driver.connect())).toEqual({ ok: true, value: undefined });
  ctx.transport.sent.length = 0;
  return ctx;
}
