import { BEAN_TEMP, HEATER, readingsCovering, type SafetyRule } from '../safety-rule';

export const frozenReadingRule: SafetyRule = {
  id: 'frozen-reading',
  action: 'alarm',
  isTripped: (state, limits) => {
    const recent = readingsCovering(state.history, limits.frozenReadingMs);
    const first = recent?.[0];
    if (!recent || !first) return false;
    // Only while heating: a steady idle temperature is normal (docs/spec/safety.md).
    return recent.every(
      (r) => (r.values[HEATER] ?? 0) > 0 && r.values[BEAN_TEMP] === first.values[BEAN_TEMP],
    );
  },
};
