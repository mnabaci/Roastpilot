import { describe, expect, it } from 'vitest';
import { ManualClock } from './clock';

describe('ManualClock', () => {
  it('starts where told and moves only on advance', () => {
    const clock = new ManualClock(1000);
    expect(clock.now()).toBe(1000);
    clock.advance(250);
    expect(clock.now()).toBe(1250);
  });

  it('refuses to go back in time', () => {
    expect(() => {
      new ManualClock().advance(-1);
    }).toThrow();
  });

  it('resolves a delay only once its time has come', async () => {
    const clock = new ManualClock();
    let done = false;
    void clock.delay(100).then(() => {
      done = true;
    });
    await clock.runFor(99);
    expect(done).toBe(false);
    await clock.runFor(1);
    expect(done).toBe(true);
  });

  it('runs chained delays at their own times', async () => {
    const clock = new ManualClock();
    const seen: number[] = [];
    const chain = async () => {
      await clock.delay(100);
      seen.push(clock.now());
      await clock.delay(50);
      seen.push(clock.now());
    };
    void chain();
    await clock.runFor(1000);
    expect(seen).toEqual([100, 150]);
    expect(clock.now()).toBe(1000);
  });
});
