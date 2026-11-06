import { COMPUTER_SLEEP, EMERGENCY_STOP } from '@roastpilot/core';
import type { SafetyEvent } from '@roastpilot/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface SafetyState {
  locked: boolean;
  /** Rules tripped right now, plus an emergency stop or computer sleep until the lock lifts. */
  tripped: string[];
}

export type SafetyStore = StoreApi<SafetyState>;

/** Stops from outside the rules, reported as trips; they hold nothing, so they end with the lock. */
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
  if (event.kind === 'cleared') return { locked: state.locked, tripped: without(event.rule) };
  return { locked: false, tripped: state.tripped.filter((id) => !ENDS_WITH_LOCK.includes(id)) };
}
