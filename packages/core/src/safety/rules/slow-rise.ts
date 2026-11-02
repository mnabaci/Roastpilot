import { BEAN_TEMP, HEATER, readingsCovering, type SafetyRule } from '../safety-rule';

export const slowRiseRule: SafetyRule = {
  id: 'slow-rise',
  action: 'alarm',
  isTripped: (state, { slowRise }) => {
    const window = readingsCovering(state.history, slowRise.windowMs);
    const first = window?.[0];
    const last = window?.at(-1);
    if (!window || !first || !last) return false;
    const heatedThroughout = window.every((r) => (r.values[HEATER] ?? 0) >= slowRise.minHeaterPct);
    const rise = (last.values[BEAN_TEMP] ?? 0) - (first.values[BEAN_TEMP] ?? 0);
    return heatedThroughout && rise < slowRise.minRiseC;
  },
};
