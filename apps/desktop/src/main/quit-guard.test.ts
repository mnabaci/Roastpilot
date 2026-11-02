import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { createQuitGuard } from './quit-guard';

function setup(stop: () => Promise<void>) {
  const calls: string[] = [];
  const entries: LogEntry[] = [];
  const guard = createQuitGuard({
    stop: () => {
      calls.push('stop');
      return stop();
    },
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

  it('quits anyway when the safe stop fails, and logs it', async () => {
    const { guard, calls, entries, event } = setup(() => Promise.reject(new Error('port gone')));
    guard(event());
    await settle();
    expect(calls).toEqual(['stop', 'quit']);
    expect(entries.map((e) => e.event)).toEqual(['app.quitting', 'app.quit-stop-failed']);
  });
});
