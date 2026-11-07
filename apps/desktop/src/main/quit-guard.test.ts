import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { createQuitGuard, type QuitStep } from './quit-guard';

function setup(stop: () => Promise<void>, more: readonly QuitStep[] = []) {
  const calls: string[] = [];
  const entries: LogEntry[] = [];
  const step = (name: string, run: () => Promise<void> | void): QuitStep => ({
    name,
    run: () => {
      calls.push(name);
      return run();
    },
  });
  const guard = createQuitGuard({
    steps: [step('stop', stop), ...more.map((s) => step(s.name, s.run))],
    quit: () => calls.push('quit'),
    logger: createLogger({ write: (e) => entries.push(e) }, 'app'),
  });
  const event = () => {
    const e = { prevented: false, preventDefault: () => (e.prevented = true) };
    return e;
  };
  return { guard, calls, entries, event };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createQuitGuard', () => {
  it('holds the first quit, safe-stops, then quits for real', async () => {
    const { guard, calls, event } = setup(() => Promise.resolve());
    const first = event();
    guard(first);
    expect(first.prevented).toBe(true);
    await settle();
    expect(calls).toEqual(['stop', 'quit']);
    const second = event();
    guard(second);
    expect(second.prevented).toBe(false);
  });

  it('ignores repeated quits while stopping', async () => {
    let finish: () => void = () => undefined;
    const { guard, calls, event } = setup(() => new Promise<void>((resolve) => (finish = resolve)));
    guard(event());
    const again = event();
    guard(again);
    expect(again.prevented).toBe(true);
    finish();
    await settle();
    expect(calls).toEqual(['stop', 'quit']);
  });

  it('runs the steps in order, each after the one before has settled', async () => {
    let finish: () => void = () => undefined;
    const { guard, calls, event } = setup(
      () => new Promise<void>((resolve) => (finish = resolve)),
      [{ name: 'save', run: () => undefined }],
    );
    guard(event());
    await settle();
    expect(calls).toEqual(['stop']);
    finish();
    await settle();
    expect(calls).toEqual(['stop', 'save', 'quit']);
  });

  it('a failing safe stop is logged, and the later steps still run before quitting', async () => {
    const { guard, calls, entries, event } = setup(
      () => Promise.reject(new Error('port gone')),
      [
        {
          name: 'close-database',
          run: () => {
            throw new Error('busy');
          },
        },
        { name: 'flush-logs', run: () => Promise.resolve() },
      ],
    );
    guard(event());
    await settle();
    expect(calls).toEqual(['stop', 'close-database', 'flush-logs', 'quit']);
    expect(entries.map((e) => [e.event, e.context?.step])).toEqual([
      ['app.quitting', undefined],
      ['app.quit-step-failed', 'stop'],
      ['app.quit-step-failed', 'close-database'],
    ]);
  });
});

describe('createQuitGuard shutdownThen', () => {
  it('runs every step, then finishes with its own action instead of quitting', async () => {
    const { guard, calls, event } = setup(() => Promise.resolve());
    guard.shutdownThen(() => calls.push('install'));
    await settle();
    expect(calls).toEqual(['stop', 'install']);
    // The installer quits the app: that quit passes straight through, no second safe stop.
    const quitting = event();
    guard(quitting);
    expect(quitting.prevented).toBe(false);
    expect(calls).toEqual(['stop', 'install']);
  });

  it('holds a quit that comes while it shuts down, and runs the steps once', async () => {
    const { guard, calls, event } = setup(() => Promise.resolve());
    guard.shutdownThen(() => calls.push('install'));
    const early = event();
    guard(early);
    expect(early.prevented).toBe(true);
    await settle();
    expect(calls).toEqual(['stop', 'install']);
  });

  it('a quit already under way wins: no install on top', async () => {
    const { guard, calls, event } = setup(() => Promise.resolve());
    guard(event());
    guard.shutdownThen(() => calls.push('install'));
    await settle();
    expect(calls).toEqual(['stop', 'quit']);
  });

  it('still finishes when a step fails', async () => {
    const { guard, calls } = setup(() => Promise.reject(new Error('no answer')));
    guard.shutdownThen(() => calls.push('install'));
    await settle();
    expect(calls).toEqual(['stop', 'install']);
  });
});
