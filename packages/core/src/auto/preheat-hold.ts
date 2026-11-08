import type { AutoTuning, HoldBatch, RoastSummary } from '@roastpilot/shared';

/** A roast that ended this recently left the drum heat-soaked: the next batch holds shorter. */
export const BACK_TO_BACK_MS = 20 * 60_000;

/** The hold a preheat runs: its length and which batch it was picked for. */
export interface PreheatHold {
  s: number;
  batch: HoldBatch;
}

/**
 * The hold for a preheat starting at `nowMs` (docs/spec/roast-control.md, Roast phases 1.3): the
 * roaster's next-batch hold when its last roast ended within the last 20 min (that moment
 * included), else its first-batch hold. Times are wall-clock ms; null when it has no roast yet.
 */
export function pickPreheatHold(
  tuning: Pick<AutoTuning, 'holdS' | 'nextHoldS'>,
  lastEndedAtMs: number | null,
  nowMs: number,
): PreheatHold {
  const backToBack =
    lastEndedAtMs !== null && nowMs >= lastEndedAtMs && nowMs - lastEndedAtMs <= BACK_TO_BACK_MS;
  return backToBack ? { s: tuning.nextHoldS, batch: 'next' } : { s: tuning.holdS, batch: 'first' };
}

type Ended = Pick<RoastSummary, 'roasterId' | 'startedAt' | 'endedAt' | 'dropTimeS'>;

/**
 * When a roaster's last saved roast ended, wall-clock ms: its cool end, else its drop; null with
 * none. Read from the saved roasts, so it holds across a restart.
 */
export function lastRoastEndMs(roasts: readonly Ended[], roasterId: number): number | null {
  let last: number | null = null;
  for (const roast of roasts) {
    if (roast.roasterId !== roasterId) continue;
    const startMs = Date.parse(roast.startedAt);
    const endMs =
      roast.endedAt !== null
        ? Date.parse(roast.endedAt)
        : roast.dropTimeS !== null
          ? startMs + roast.dropTimeS * 1_000
          : Number.NaN;
    if (Number.isFinite(endMs) && (last === null || endMs > last)) last = endMs;
  }
  return last;
}
