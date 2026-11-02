import type { SafetyRule } from '../safety-rule';

export const maxRoastTimeRule: SafetyRule = {
  id: 'max-roast-time',
  action: 'safe-stop',
  isTripped: (state, limits) =>
    state.roastStartedMs !== undefined && state.nowMs - state.roastStartedMs >= limits.maxRoastMs,
};
