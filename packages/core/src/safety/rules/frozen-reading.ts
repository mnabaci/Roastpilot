import { BEAN_TEMP, HEATER, readingsCovering, type SafetyRule } from '../safety-rule';

export const frozenReadingRule: SafetyRule = {
  id: 'frozen-reading',
  action: 'alarm',
  isTripped: (state, limits) => {
    const window = readingsCovering(state.history, limits.frozenReadingMs);
    const first = window?.[0];
    if (!window || !first) return false;
    // Only while heating: a steady idle temperature is normal (docs/spec/safety.md).
    return window.every(
      (r) => (r.values[HEATER] ?? 0) > 0 && r.values[BEAN_TEMP] === first.values[BEAN_TEMP],
    );
  },
};
