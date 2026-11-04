import { rateOfRise } from '@roastpilot/core';
import type { Reading, RoastState } from '@roastpilot/shared';

export interface RoastNumbers {
  bt: number | undefined;
  /** °C/min over the last 30 s. */
  ror: number | undefined;
  /** Seconds since charge, frozen at drop. */
  elapsedS: number | undefined;
  /** Seconds since Preheat, while preheating. */
  preheatS: number | undefined;
  /** Seconds since first crack, frozen at drop. */
  developmentS: number | undefined;
  /** Development as a share of the roast, 0–100. */
  developmentPct: number | undefined;
  /** Seconds of cooling left. */
  coolingLeftS: number | undefined;
}

const seconds = (ms: number) => Math.max(0, ms) / 1000;

/** The big numbers (docs/spec/manual-mode.md). "Now" is the latest reading, on main's clock. */
export function roastNumbers(roast: RoastState, readings: readonly Reading[]): RoastNumbers {
  const latest = readings.at(-1);
  const nowMs = latest?.atMs;
  const endMs = roast.droppedAtMs ?? nowMs;
  const elapsedMs =
    roast.chargedAtMs !== null && endMs !== undefined ? endMs - roast.chargedAtMs : undefined;
  const developmentMs =
    roast.firstCrackAtMs !== null && endMs !== undefined ? endMs - roast.firstCrackAtMs : undefined;
  return {
    bt: latest?.values.bt,
    ror: rateOfRise(readings),
    elapsedS: elapsedMs === undefined ? undefined : seconds(elapsedMs),
    preheatS:
      roast.phase === 'preheat' && roast.preheatAtMs !== null && nowMs !== undefined
        ? seconds(nowMs - roast.preheatAtMs)
        : undefined,
    developmentS: developmentMs === undefined ? undefined : seconds(developmentMs),
    developmentPct:
      developmentMs !== undefined && elapsedMs !== undefined && elapsedMs > 0
        ? (Math.max(0, developmentMs) / elapsedMs) * 100
        : undefined,
    coolingLeftS:
      roast.coolingEndsAtMs !== null && nowMs !== undefined
        ? seconds(roast.coolingEndsAtMs - nowMs)
        : undefined,
  };
}
