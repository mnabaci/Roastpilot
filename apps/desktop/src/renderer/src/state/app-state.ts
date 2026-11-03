import { MAX_HISTORY_READINGS } from '@roastpilot/core';
import {
  DEFAULT_SETTINGS,
  type ConnectionState,
  type Reading,
  type RoastState,
  type SafetyEvent,
  type Settings,
  type Snapshot,
} from '@roastpilot/shared';

export interface SafetyState {
  locked: boolean;
  /** Rules tripped right now, plus `emergency-stop` until the lock lifts. */
  tripped: string[];
}

/** What the renderer knows about main: a mirror, filled by `syncWithMain`. */
export interface AppState {
  /** False until the first snapshot arrives. */
  ready: boolean;
  connection: ConnectionState;
  roast: RoastState;
  readings: Reading[];
  safety: SafetyState;
  settings: Settings;
}

export const INITIAL_STATE: AppState = {
  ready: false,
  connection: { status: 'disconnected' },
  roast: {
    phase: 'ready',
    chargedAtMs: null,
    firstCrackAtMs: null,
    droppedAtMs: null,
    coolingEndsAtMs: null,
    events: [],
  },
  readings: [],
  safety: { locked: false, tripped: [] },
  settings: DEFAULT_SETTINGS,
};

// Pure updates, one per thing main tells us. Kept apart from the store so they test without React.

export function applySnapshot(state: AppState, snapshot: Snapshot): AppState {
  return { ...state, ready: true, ...snapshot, readings: [...snapshot.readings] };
}

export function applyReading(state: AppState, reading: Reading): AppState {
  const readings = [...state.readings, reading];
  if (readings.length > MAX_HISTORY_READINGS)
    readings.splice(0, readings.length - MAX_HISTORY_READINGS);
  return { ...state, readings };
}

/** Preheat starts a new roast, so main drops its readings; do the same here. */
export function applyRoast(state: AppState, roast: RoastState): AppState {
  const newRoast = roast.phase === 'preheat' && state.roast.phase !== 'preheat';
  return { ...state, roast, readings: newRoast ? [] : state.readings };
}

export function applySafetyEvent(state: AppState, event: SafetyEvent): AppState {
  const { locked, tripped } = state.safety;
  const without = (rule: string) => tripped.filter((id) => id !== rule);
  const safety: SafetyState =
    event.kind === 'tripped'
      ? {
          locked: locked || event.action === 'safe-stop',
          tripped: [...without(event.rule), event.rule],
        }
      : event.kind === 'cleared'
        ? { locked, tripped: without(event.rule) }
        : { locked: false, tripped: without(EMERGENCY_STOP_RULE) };
  return { ...state, safety };
}

/** The monitor reports an emergency stop as a trip of this rule; it holds nothing, so it ends with the lock. */
export const EMERGENCY_STOP_RULE = 'emergency-stop';
