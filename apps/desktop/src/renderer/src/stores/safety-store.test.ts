import { describe, expect, it } from 'vitest';
import { applySafetyEvent, type SafetyState } from './safety-store';

const none: SafetyState = { locked: false, tripped: [] };

describe('safety store', () => {
  it('a safe-stop trip locks the heater; an alarm only shows', () => {
    const alarm = applySafetyEvent(none, {
      kind: 'tripped',
      rule: 'slow-rise',
      action: 'alarm',
      atMs: 1,
    });
    expect(alarm).toEqual({ locked: false, tripped: ['slow-rise'] });
    const stop = applySafetyEvent(alarm, {
      kind: 'tripped',
      rule: 'max-temperature',
      action: 'safe-stop',
      atMs: 2,
    });
    expect(stop).toEqual({ locked: true, tripped: ['slow-rise', 'max-temperature'] });
  });

  it('a clear removes the rule but keeps the lock until it is lifted', () => {
    let state = applySafetyEvent(none, {
      kind: 'tripped',
      rule: 'max-temperature',
      action: 'safe-stop',
      atMs: 1,
    });
    state = applySafetyEvent(state, { kind: 'cleared', rule: 'max-temperature', atMs: 2 });
    expect(state).toEqual({ locked: true, tripped: [] });
    expect(applySafetyEvent(state, { kind: 'unlocked', atMs: 3 })).toEqual(none);
  });

  it('an emergency stop lasts until the lock lifts, and never shows twice', () => {
    const estop = {
      kind: 'tripped',
      rule: 'emergency-stop',
      action: 'safe-stop',
      atMs: 1,
    } as const;
    const state = applySafetyEvent(applySafetyEvent(none, estop), estop);
    expect(state).toEqual({ locked: true, tripped: ['emergency-stop'] });
    expect(applySafetyEvent(state, { kind: 'unlocked', atMs: 2 })).toEqual(none);
  });

  it('a computer-sleep stop also ends with the lock, so its banner never outlives Acknowledge', () => {
    const sleep = {
      kind: 'tripped',
      rule: 'computer-sleep',
      action: 'safe-stop',
      atMs: 1,
    } as const;
    const state = applySafetyEvent(none, sleep);
    expect(state).toEqual({ locked: true, tripped: ['computer-sleep'] });
    expect(applySafetyEvent(state, { kind: 'unlocked', atMs: 2 })).toEqual(none);
  });
});
