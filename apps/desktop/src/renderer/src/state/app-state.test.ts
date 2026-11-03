import { describe, expect, it } from 'vitest';
import { MAX_HISTORY_READINGS } from '@roastpilot/core';
import {
  applyReading,
  applyRoast,
  applySafetyEvent,
  applySnapshot,
  INITIAL_STATE,
  type AppState,
} from './app-state';

const reading = (atMs: number, bt = 100) => ({ atMs, values: { bt } });

describe('app state', () => {
  it('a snapshot fills everything and marks the state ready', () => {
    const next = applySnapshot(INITIAL_STATE, {
      connection: { status: 'lost' },
      roast: { ...INITIAL_STATE.roast, phase: 'roasting', chargedAtMs: 5 },
      readings: [reading(1)],
      safety: { locked: true, tripped: ['lost-connection'] },
    });
    expect(next).toMatchObject({
      ready: true,
      connection: { status: 'lost' },
      readings: [reading(1)],
      safety: { locked: true },
    });
  });

  it('keeps at most the history main keeps', () => {
    let state: AppState = {
      ...INITIAL_STATE,
      readings: Array.from({ length: MAX_HISTORY_READINGS }, (_, i) => reading(i)),
    };
    state = applyReading(state, reading(MAX_HISTORY_READINGS));
    expect(state.readings).toHaveLength(MAX_HISTORY_READINGS);
    expect(state.readings.at(-1)?.atMs).toBe(MAX_HISTORY_READINGS);
    expect(state.readings[0]?.atMs).toBe(1);
  });

  it('Preheat starts a new roast and drops the old readings; other changes keep them', () => {
    const withReadings = { ...INITIAL_STATE, readings: [reading(1)] };
    const preheat = applyRoast(withReadings, { ...INITIAL_STATE.roast, phase: 'preheat' });
    expect(preheat.readings).toEqual([]);
    const charged = applyRoast(
      { ...preheat, readings: [reading(2)] },
      { ...preheat.roast, phase: 'roasting' },
    );
    expect(charged.readings).toEqual([reading(2)]);
  });

  it('a safe-stop trip locks the heater; an alarm only shows', () => {
    const alarm = applySafetyEvent(INITIAL_STATE, {
      kind: 'tripped',
      rule: 'slow-rise',
      action: 'alarm',
      atMs: 1,
    });
    expect(alarm.safety).toEqual({ locked: false, tripped: ['slow-rise'] });
    const stop = applySafetyEvent(alarm, {
      kind: 'tripped',
      rule: 'max-temperature',
      action: 'safe-stop',
      atMs: 2,
    });
    expect(stop.safety).toEqual({ locked: true, tripped: ['slow-rise', 'max-temperature'] });
  });

  it('a clear removes the rule but keeps the lock until it is lifted', () => {
    let state = applySafetyEvent(INITIAL_STATE, {
      kind: 'tripped',
      rule: 'max-temperature',
      action: 'safe-stop',
      atMs: 1,
    });
    state = applySafetyEvent(state, { kind: 'cleared', rule: 'max-temperature', atMs: 2 });
    expect(state.safety).toEqual({ locked: true, tripped: [] });
    state = applySafetyEvent(state, { kind: 'unlocked', atMs: 3 });
    expect(state.safety).toEqual({ locked: false, tripped: [] });
  });

  it('an emergency stop lasts until the lock lifts, and never shows twice', () => {
    const estop = {
      kind: 'tripped',
      rule: 'emergency-stop',
      action: 'safe-stop',
      atMs: 1,
    } as const;
    let state = applySafetyEvent(applySafetyEvent(INITIAL_STATE, estop), estop);
    expect(state.safety).toEqual({ locked: true, tripped: ['emergency-stop'] });
    state = applySafetyEvent(state, { kind: 'unlocked', atMs: 2 });
    expect(state.safety).toEqual({ locked: false, tripped: [] });
  });
});
