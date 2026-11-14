import { rateOfRise, rorReadings } from '@roastpilot/core';
import type { Reading, RoastState } from '@roastpilot/shared';

export interface RoastNumbers {
  bt: number | undefined;
  /** The environment temperature, on a roaster with an ET probe. */
  et: number | undefined;
  /** °C/min over the last 30 s since charge; none before it, as on the chart. */
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
    et: latest?.values.et,
    ror:
      roast.chargedAtMs === null ? undefined : rateOfRise(rorReadings(readings, roast.chargedAtMs)),
    elapsedS: elapsedMs === undefined ? undefined : seconds(elapsedMs),
    preheatS:
      // typeof, not !== null: a main process from before preheatAtMs existed leaves it out.
      roast.phase === 'preheat' && typeof roast.preheatAtMs === 'number' && nowMs !== undefined
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
