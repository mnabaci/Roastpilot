import { BEAN_TEMP, HEATER, readingsCovering, type SafetyRule } from '../safety-rule';

export const slowRiseRule: SafetyRule = {
  id: 'slow-rise',
  action: 'alarm',
  isTripped: (state, { slowRise }) => {
    const recent = readingsCovering(state.history, slowRise.windowMs);
    const first = recent?.[0];
    const last = recent?.at(-1);
    if (!recent || !first || !last) return false;
    const heatedThroughout = recent.every((r) => (r.values[HEATER] ?? 0) >= slowRise.minHeaterPct);
    const rise = (last.values[BEAN_TEMP] ?? 0) - (first.values[BEAN_TEMP] ?? 0);
    return heatedThroughout && rise < slowRise.minRiseC;
  },
};
