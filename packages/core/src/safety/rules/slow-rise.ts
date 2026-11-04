import {
  BEAN_TEMP,
  HEATER,
  readingsCovering,
  type SafetyRule,
  type SafetyState,
} from '../safety-rule';

/**
 * In a roast, the beans pull BT down from charge to the turning point: the rise only counts from
 * there, or from `maxMs` after charge if no turning point is found. Undefined outside a roast.
 */
function watchFromMs(
  { roastStartedMs, turningPointMs }: SafetyState,
  maxMs: number,
): number | undefined {
  if (roastStartedMs === undefined) return undefined;
  return turningPointMs ?? roastStartedMs + maxMs;
}

export const slowRiseRule: SafetyRule = {
  id: 'slow-rise',
  action: 'alarm',
  isTripped: (state, { slowRise }) => {
    const recent = readingsCovering(state.history, slowRise.windowMs);
    const first = recent?.[0];
    const last = recent?.at(-1);
    if (!recent || !first || !last) return false;
    // The window must lie after the charge dip.
    const fromMs = watchFromMs(state, slowRise.afterChargeMs);
    if (fromMs !== undefined && first.atMs < fromMs) return false;
    const heatedThroughout = recent.every((r) => (r.values[HEATER] ?? 0) >= slowRise.minHeaterPct);
    const rise = (last.values[BEAN_TEMP] ?? 0) - (first.values[BEAN_TEMP] ?? 0);
    return heatedThroughout && rise < slowRise.minRiseC;
  },
};
