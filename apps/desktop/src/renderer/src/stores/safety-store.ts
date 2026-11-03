import type { SafetyEvent } from '@roastpilot/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface SafetyState {
  locked: boolean;
  /** Rules tripped right now, plus `emergency-stop` until the lock lifts. */
  tripped: string[];
}

export type SafetyStore = StoreApi<SafetyState>;

/** The monitor reports an emergency stop as a trip of this rule; it holds nothing, so it ends with the lock. */
export const EMERGENCY_STOP_RULE = 'emergency-stop';

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
  return { locked: false, tripped: without(EMERGENCY_STOP_RULE) };
}
