import type { LogEntry } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../clock';
import { createLogger } from '../logging/logger';
import { CoolingTimer } from './cooling-timer';

function setup() {
  const clock = new ManualClock();
  const entries: LogEntry[] = [];
  const timer = new CoolingTimer(clock, createLogger({ write: (e) => entries.push(e) }, 'roast'));
  const ended: number[] = [];
  const onEnd = () => {
    ended.push(clock.now());
    return Promise.resolve();
  };
  return { clock, timer, entries, ended, onEnd };
}

describe('CoolingTimer', () => {
  it('ends at the time given', async () => {
    const { clock, timer, ended, onEnd } = setup();
    timer.schedule(60_000, onEnd);
    await clock.runFor(59_000);
    expect(ended).toEqual([]);
    await clock.runFor(1000);
    expect(ended).toEqual([60_000]);
  });

  it('a new schedule stands the old one down', async () => {
    const { clock, timer, ended, onEnd } = setup();
    timer.schedule(60_000, onEnd);
    timer.schedule(120_000, onEnd);
    await clock.runFor(120_000);
    expect(ended).toEqual([120_000]);
  });

  it('cancel stands it down', async () => {
    const { clock, timer, ended, onEnd } = setup();
    timer.schedule(60_000, onEnd);
    timer.cancel();
    await clock.runFor(120_000);
    expect(ended).toEqual([]);
  });

  it('a time already past ends at once', async () => {
    const { clock, timer, ended, onEnd } = setup();
    clock.advance(5000);
    timer.schedule(1000, onEnd);
    await clock.runFor(0);
    expect(ended).toEqual([5000]);
  });

  it('logs a failing end instead of losing it', async () => {
    const { clock, timer, entries } = setup();
    timer.schedule(1000, () => Promise.reject(new Error('send failed')));
    await clock.runFor(1000);
    expect(entries.find((e) => e.event === 'roast.cooling-timer-failed')).toMatchObject({
      level: 'error',
    });
  });
});
