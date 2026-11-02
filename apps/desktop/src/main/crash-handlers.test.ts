import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { installCrashHandlers } from './crash-handlers';

function setup(stopRoaster: () => Promise<void> = () => Promise.resolve()) {
  const emitter = new EventEmitter();
  const entries: LogEntry[] = [];
  const calls: string[] = [];
  installCrashHandlers({
    process: emitter as unknown as Pick<NodeJS.Process, 'on'>,
    logger: createLogger({ write: (e) => entries.push(e) }, 'app'),
    stopRoaster: () => {
      calls.push('stop');
      return stopRoaster();
    },
    emergencyStop: () => calls.push('emergency-stop'),
    flushLogs: () => {
      calls.push('flush');
      return Promise.resolve();
    },
    exit: (code) => calls.push(`exit:${String(code)}`),
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { emitter, entries, calls, settle };
}

describe('installCrashHandlers', () => {
  it('on an uncaught exception: logs, safe-stops, flushes the log, then exits', async () => {
    const { emitter, entries, calls, settle } = setup();
    emitter.emit('uncaughtException', new Error('boom'));
    await settle();
    expect(entries[0]).toMatchObject({
      level: 'error',
      event: 'app.uncaught-exception',
      context: { error: { message: 'boom' } },
    });
    expect(calls).toEqual(['stop', 'flush', 'exit:1']);
  });

  it('still exits when the safe stop fails, and logs why', async () => {
    const { emitter, entries, calls, settle } = setup(() => Promise.reject(new Error('port gone')));
    emitter.emit('uncaughtException', new Error('boom'));
    await settle();
    expect(entries.map((e) => e.event)).toEqual([
      'app.uncaught-exception',
      'app.crash-stop-failed',
    ]);
    expect(calls).toEqual(['stop', 'flush', 'exit:1']);
  });

  it('stops only once when errors pile up while exiting', async () => {
    const { emitter, calls, entries, settle } = setup();
    emitter.emit('uncaughtException', new Error('one'));
    emitter.emit('uncaughtException', new Error('two'));
    await settle();
    expect(calls.filter((c) => c === 'stop')).toHaveLength(1);
    expect(entries).toHaveLength(2);
  });

  it('on an unhandled rejection: logs and emergency-stops, without exiting', () => {
    const { emitter, entries, calls } = setup();
    emitter.emit('unhandledRejection', 'nope');
    expect(entries[0]).toMatchObject({
      event: 'app.unhandled-rejection',
      context: { error: 'nope' },
    });
    expect(calls).toEqual(['emergency-stop']);
  });
});
