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
});
