import type { SafetyRule } from '../safety-rule';

export const lostConnectionRule: SafetyRule = {
  id: 'lost-connection',
  action: 'safe-stop',
  isTripped: (state, limits) =>
    state.armed &&
    state.lastValidReadingMs !== undefined &&
    state.nowMs - state.lastValidReadingMs >= limits.lostConnectionMs,
};
