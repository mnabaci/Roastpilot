import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CRASH_SAVE_TIMEOUT_MS, installCrashHandlers } from './crash-handlers';

interface Fakes {
  stopRoaster?: () => Promise<void>;
  saveRoast?: () => Promise<void> | void;
  flushLogs?: () => Promise<void>;
}

function setup({
  stopRoaster = () => Promise.resolve(),
  saveRoast = () => Promise.resolve(),
  flushLogs = () => Promise.resolve(),
}: Fakes = {}) {
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
    saveRoast: () => {
      calls.push('save');
      return saveRoast();
    },
    flushLogs: () => {
      calls.push('flush');
      return flushLogs();
    },
    exit: (code) => calls.push(`exit:${String(code)}`),
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { emitter, entries, calls, settle };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('installCrashHandlers', () => {
  it('on an uncaught exception mid-roast: logs, safe-stops, saves, flushes the log, then exits', async () => {
    const { emitter, entries, calls, settle } = setup();
    emitter.emit('uncaughtException', new Error('boom'));
    await settle();
    expect(entries[0]).toMatchObject({
      level: 'error',
      event: 'app.uncaught-exception',
      context: { error: { message: 'boom' } },
    });
    expect(entries).toHaveLength(1);
    expect(calls).toEqual(['stop', 'save', 'flush', 'exit:1']);
  });

  it('does not start saving until the safe stop has settled', async () => {
    let finishStop: () => void = () => undefined;
    const { emitter, calls, settle } = setup({
      stopRoaster: () =>
        new Promise<void>((resolve) => {
          finishStop = resolve;
        }),
    });
    emitter.emit('uncaughtException', new Error('boom'));
    await settle();
    expect(calls).toEqual(['stop']);
    finishStop();
    await settle();
    expect(calls).toEqual(['stop', 'save', 'flush', 'exit:1']);
  });

  it('still saves and exits when the safe stop fails, and logs why', async () => {
    const { emitter, entries, calls, settle } = setup({
      stopRoaster: () => Promise.reject(new Error('port gone')),
    });
    emitter.emit('uncaughtException', new Error('boom'));
    await settle();
    expect(entries.map((e) => e.event)).toEqual([
      'app.uncaught-exception',
      'app.crash-stop-failed',
    ]);
    expect(calls).toEqual(['stop', 'save', 'flush', 'exit:1']);
  });

  it('still flushes and exits when the save fails, and logs why', async () => {
    const { emitter, entries, calls, settle } = setup({
      saveRoast: () => Promise.reject(new Error('disk full')),
    });
    emitter.emit('uncaughtException', new Error('boom'));
    await settle();
    expect(entries[1]).toMatchObject({
      event: 'app.crash-save-failed',
      context: { error: { message: 'disk full' } },
    });
    expect(calls).toEqual(['stop', 'save', 'flush', 'exit:1']);
  });

  it('treats a save that throws synchronously like a failed save', async () => {
    const { emitter, entries, calls, settle } = setup({
      saveRoast: () => {
        throw new Error('db closed');
      },
    });
    emitter.emit('uncaughtException', new Error('boom'));
    await settle();
    expect(entries.map((e) => e.event)).toContain('app.crash-save-failed');
    expect(calls).toEqual(['stop', 'save', 'flush', 'exit:1']);
  });

  it('gives up on a save that hangs past the limit, logs it, and still exits', async () => {
    vi.useFakeTimers();
    const { emitter, entries, calls } = setup({
      saveRoast: () => new Promise<void>(() => undefined),
    });
    emitter.emit('uncaughtException', new Error('boom'));
    await vi.advanceTimersByTimeAsync(CRASH_SAVE_TIMEOUT_MS - 1);
    expect(calls).toEqual(['stop', 'save']);
    await vi.advanceTimersByTimeAsync(1);
    expect(entries[1]).toMatchObject({
      event: 'app.crash-save-timed-out',
      context: { timeoutMs: CRASH_SAVE_TIMEOUT_MS },
    });
    expect(calls).toEqual(['stop', 'save', 'flush', 'exit:1']);
  });

  it('still exits when the log flush fails, and logs why', async () => {
    const { emitter, entries, calls, settle } = setup({
      flushLogs: () => Promise.reject(new Error('stream closed')),
    });
    emitter.emit('uncaughtException', new Error('boom'));
    await settle();
    expect(entries.map((e) => e.event)).toContain('app.crash-flush-failed');
    expect(calls).toEqual(['stop', 'save', 'flush', 'exit:1']);
  });

  it('stops and saves only once when errors pile up while exiting', async () => {
    const { emitter, calls, entries, settle } = setup();
    emitter.emit('uncaughtException', new Error('one'));
    emitter.emit('uncaughtException', new Error('two'));
    await settle();
    expect(calls.filter((c) => c === 'stop')).toHaveLength(1);
    expect(calls.filter((c) => c === 'save')).toHaveLength(1);
    expect(entries).toHaveLength(2);
  });

  it('on an unhandled rejection: logs and emergency-stops, without saving or exiting', () => {
    const { emitter, entries, calls } = setup();
    emitter.emit('unhandledRejection', 'nope');
    expect(entries[0]).toMatchObject({
      event: 'app.unhandled-rejection',
      context: { error: 'nope' },
    });
    expect(calls).toEqual(['emergency-stop']);
  });
});
