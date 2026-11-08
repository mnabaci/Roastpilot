import { COMPUTER_SLEEP, EMERGENCY_STOP } from '@roastpilot/core';
import type { SafetyEvent } from '@roastpilot/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface SafetyState {
  locked: boolean;
  /** Rules tripped right now, plus an emergency stop or computer sleep until the lock lifts. */
  tripped: string[];
  /**
   * Readings came back after a lost connection while the heater stays locked: the banner says
   * the roaster is back (docs/spec/safety.md). Gone with the lock.
   */
  reconnected?: boolean;
}

export type SafetyStore = StoreApi<SafetyState>;

/** Stops from outside the rules, reported as trips; they hold nothing, so they end with the lock. */
export const LOST_CONNECTION = 'lost-connection';

const ENDS_WITH_LOCK: readonly string[] = [EMERGENCY_STOP, COMPUTER_SLEEP];

export const createSafetyStore = (
  state: SafetyState = { locked: false, tripped: [] },
): SafetyStore => createStore(() => state);

export function applySafetyEvent(state: SafetyState, event: SafetyEvent): SafetyState {
  const without = (rule: string) => state.tripped.filter((id) => id !== rule);
  if (event.kind === 'tripped')
    return {
      locked: state.locked || event.action === 'safe-stop',
      tripped: [...without(event.rule), event.rule],
    };
  if (event.kind === 'cleared') {
    const back = event.rule === LOST_CONNECTION && state.locked;
    return {
      locked: state.locked,
      tripped: without(event.rule),
      ...(back || state.reconnected ? { reconnected: true } : {}),
    };
  }
  return { locked: false, tripped: state.tripped.filter((id) => !ENDS_WITH_LOCK.includes(id)) };
}
