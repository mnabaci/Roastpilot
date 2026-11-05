import type { Reading, SafetyAction } from '@roastpilot/shared';
import type { SafetyLimits } from './safety-limits';

/** What the rules see. Built by the SafetyMonitor; rules never change it. */
export interface SafetyState {
  nowMs: number;
  /** True once the roaster has connected; lost connection can't trip before. */
  armed: boolean;
  lastValidReadingMs: number | undefined;
  /** Valid readings, oldest first, reaching back a little further than the longest rule window. */
  history: readonly Reading[];
  roastStartedMs: number | undefined;
  /** The roast's turning point, once found; BT falls between charge and here. */
  turningPointMs: number | undefined;
}

export interface SafetyRule {
  id: string;
  action: SafetyAction;
  isTripped(state: SafetyState, limits: SafetyLimits): boolean;
}

export const BEAN_TEMP = 'bt';
export const HEATER = 'heater';

/**
 * The readings that cover the `windowMs` before the latest reading: the last one at or before the
 * window start, then everything after it. Undefined if history doesn't reach back that far.
 * Windows end at the latest reading, not at now, so stale data during a lost connection never trips a stall.
 */
export function readingsCovering(
  history: readonly Reading[],
  windowMs: number,
): readonly Reading[] | undefined {
  const latest = history.at(-1);
  if (!latest) return undefined;
  const startMs = latest.atMs - windowMs;
  const firstIndex = history.findLastIndex((r) => r.atMs <= startMs);
  return firstIndex === -1 ? undefined : history.slice(firstIndex);
}
