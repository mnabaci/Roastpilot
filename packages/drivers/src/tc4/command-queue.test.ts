import { createLogger, ManualClock } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { COMMAND_GAP_MS, CommandQueue, REPLY_TIMEOUT_MS, WRITE_TIMEOUT_MS } from './command-queue';
import { FakeTransport } from './fake-transport';
import { isReadReplyShape, isVersionReplyShape } from './replies';

const READ_LINE = '0.00,180.25,180.25,40,60,0';

async function setup() {
  const clock = new ManualClock();
  const transport = new FakeTransport(clock);
  await transport.open();
  const logs: LogEntry[] = [];
  const logger = createLogger({ write: (e) => logs.push(e) }, 'driver');
  return { clock, transport, logs, queue: new CommandQueue(transport, clock, logger) };
}

describe('CommandQueue', () => {
  it('spaces commands without replies by the gap', async () => {
    const { clock, transport, queue } = await setup();
    const sends = [queue.send('OT1;0'), queue.send('OT2;100'), queue.send('COOL;100')];
    await clock.runFor(1000);
    await Promise.all(sends);
    expect(transport.sent.map((s) => s.atMs)).toEqual([0, COMMAND_GAP_MS, 2 * COMMAND_GAP_MS]);
  });

  it('sends the next command as soon as a reply arrives', async () => {
    const { clock, transport, queue } = await setup();
    transport.reply = (line) => (line === 'VERSION' ? '1' : undefined);
    const version = queue.request('VERSION', isVersionReplyShape);
    const next = queue.send('OT1;0');
    await clock.runFor(1000);
    expect(await version).toEqual({ ok: true, value: '1' });
    await next;
    expect(transport.sent.map((s) => s.atMs)).toEqual([0, 0]);
  });

  it('times out a request with no reply, then keeps the gap', async () => {
    const { clock, transport, queue } = await setup();
    const version = queue.request('VERSION', isVersionReplyShape);
    const next = queue.send('READ');
    await clock.runFor(2000);
    expect(await version).toEqual({ ok: false, error: { kind: 'no-reply', command: 'VERSION' } });
    await next;
    expect(transport.sent[1]?.atMs).toBe(REPLY_TIMEOUT_MS + COMMAND_GAP_MS);
  });

  it('gives up on a write the port never finishes, so later commands still go out', async () => {
    const { clock, transport, queue } = await setup();
    const write = transport.write.bind(transport);
    let hang = true;
    transport.write = (line) => (hang ? new Promise(() => undefined) : write(line));
    const stuck = queue.send('OT1;100');
    await clock.runFor(WRITE_TIMEOUT_MS);
    expect(await stuck).toEqual({ ok: false, error: { kind: 'disconnected' } });
    hang = false;
    const next = queue.send('OT1;0');
    await clock.runFor(100);
    expect(await next).toEqual({ ok: true, value: undefined });
  });

  it('ignores lines nobody asked for', async () => {
    const { clock, transport, queue } = await setup();
    transport.emit('boot noise');
    transport.reply = () => '1';
    const version = queue.request('VERSION', isVersionReplyShape);
    await clock.runFor(1000);
    expect(await version).toEqual({ ok: true, value: '1' });
  });

  it('reports disconnected when the port closes while waiting for a reply', async () => {
    const { clock, transport, queue } = await setup();
    const version = queue.request('VERSION', isVersionReplyShape);
    await clock.runFor(100);
    transport.drop();
    await clock.runFor(1000);
    expect(await version).toEqual({ ok: false, error: { kind: 'disconnected' } });
  });

  it('reports disconnected when the write fails', async () => {
    const { clock, transport, queue } = await setup();
    transport.drop();
    const sent = queue.send('OT1;0');
    await clock.runFor(100);
    expect(await sent).toEqual({ ok: false, error: { kind: 'disconnected' } });
  });

  it('keeps going after a transport throws', async () => {
    const { clock, transport, queue } = await setup();
    const write = transport.write.bind(transport);
    transport.write = (line) =>
      line === 'BOOM' ? Promise.reject(new Error('driver bug')) : write(line);
    const boom = queue.send('BOOM');
    const next = queue.send('OT1;0');
    await clock.runFor(1000);
    await expect(boom).rejects.toThrow('driver bug');
    expect((await next).ok).toBe(true);
  });

  it('does not take a late VERSION reply as the next READ reply', async () => {
    const { clock, transport, logs, queue } = await setup();
    const version = queue.request('VERSION', isVersionReplyShape);
    const read = queue.request('READ', isReadReplyShape);
    await clock.runFor(REPLY_TIMEOUT_MS + COMMAND_GAP_MS + 10);
    expect(transport.sentLines()).toEqual(['VERSION', 'READ']);
    transport.emit('1');
    transport.emit(READ_LINE);
    await clock.runFor(10);
    expect(await version).toEqual({ ok: false, error: { kind: 'no-reply', command: 'VERSION' } });
    expect(await read).toEqual({ ok: true, value: READ_LINE });
    expect(logs).toContainEqual(
      expect.objectContaining({
        level: 'debug',
        event: 'driver.unmatched-line-dropped',
        context: { command: 'READ', line: '1' },
      }),
    );
  });

  it('does not take a late READ reply as the VERSION reply', async () => {
    const { clock, transport, queue } = await setup();
    const read = queue.request('READ', isReadReplyShape);
    const version = queue.request('VERSION', isVersionReplyShape);
    await clock.runFor(REPLY_TIMEOUT_MS + COMMAND_GAP_MS + 10);
    transport.emit(READ_LINE);
    transport.emit('1');
    await clock.runFor(10);
    expect(await read).toEqual({ ok: false, error: { kind: 'no-reply', command: 'READ' } });
    expect(await version).toEqual({ ok: true, value: '1' });
  });

  it('keeps waiting past a wrong line and still times out without its own reply', async () => {
    const { clock, transport, queue } = await setup();
    const read = queue.request('READ', isReadReplyShape);
    await clock.runFor(100);
    transport.emit('1');
    await clock.runFor(REPLY_TIMEOUT_MS);
    expect(await read).toEqual({ ok: false, error: { kind: 'no-reply', command: 'READ' } });
  });

  it('drops a late reply arriving in the gap after a timeout (same-shape quarantine)', async () => {
    const { clock, transport, queue } = await setup();
    const first = queue.request('READ', isReadReplyShape);
    const second = queue.request('READ', isReadReplyShape);
    await clock.runFor(REPLY_TIMEOUT_MS + 5);
    expect(transport.sentLines()).toEqual(['READ']);
    transport.emit('0.00,1.00,1.00,0,0,0');
    await clock.runFor(COMMAND_GAP_MS);
    expect(transport.sentLines()).toEqual(['READ', 'READ']);
    transport.emit(READ_LINE);
    await clock.runFor(10);
    expect((await first).ok).toBe(false);
    expect(await second).toEqual({ ok: true, value: READ_LINE });
  });

  it('reports disconnected when the port closes while a wrong line was dropped', async () => {
    const { clock, transport, queue } = await setup();
    const read = queue.request('READ', isReadReplyShape);
    await clock.runFor(100);
    transport.emit('1');
    transport.drop();
    await clock.runFor(10);
    expect(await read).toEqual({ ok: false, error: { kind: 'disconnected' } });
  });
});
