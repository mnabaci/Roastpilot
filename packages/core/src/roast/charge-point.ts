import type { Reading } from '@roastpilot/shared';
import { BEAN_TEMP } from '../safety/safety-rule';

/** How far back from the Start press the charge drop is looked for. */
export const CHARGE_LOOKBACK_MS = 60_000;

/**
 * Artisan's auto-CHARGE test (`BTbreak` and `checkTop` in artisanlib/main.py, "Standard" mode at
 * 1 s readings): only above 77 °C, and the fall after the point must be steep against the trend
 * before it.
 */
const MIN_BT = 77;
/** Each of the two readings after the point falls at least this much (°C per step). */
const MIN_FALL_PER_STEP = 0.67;
/** The same over every other reading (Artisan's `f_dtwice`). */
const LOOSE_FACTOR = 1.5;
const OFFSET = 0.5;
const SLOPE_FACTOR = 2.5;
const MAX_PRE = 6.4;
/** Rising before and falling after: their sum must pass this. */
const TURN_DIFF = 0.78;

/**
 * True when BT breaks down after `p[3]`: `p` is six temperatures, oldest first, with `p[3]` the
 * last one before the fall.
 */
function breaksAfter(p: readonly number[], minFall: number): boolean {
  const [p0 = 0, p1 = 0, p2 = 0, p3 = 0, p4 = 0, p5 = 0] = p;
  const before = (p0 - p1 + (p1 - p2)) / 2; // > 0 when falling
  const step1 = p4 - p3;
  const step2 = p5 - p4;
  const after = (step1 + step2) / 2; // < 0 when falling
  return (
    step1 < -minFall &&
    step2 < -minFall &&
    (Math.abs(after) > Math.min(MAX_PRE, OFFSET + SLOPE_FACTOR * Math.abs(before)) ||
      (after < 0 && before < 0 && -before - after > TURN_DIFF))
  );
}

/**
 * The charge point (docs/spec/manual-mode.md): the reading just before the charge drop, the
 * earliest found in the minute before Start was pressed. Undefined when there is no clear drop.
 */
export function findChargePoint(
  readings: readonly Reading[],
  pressedAtMs: number,
): Reading | undefined {
  const window = readings.filter(
    (r) =>
      r.atMs >= pressedAtMs - CHARGE_LOOKBACK_MS &&
      r.atMs <= pressedAtMs &&
      Number.isFinite(r.values[BEAN_TEMP]),
  );
  const bt = (i: number) => window[i]?.values[BEAN_TEMP] ?? Number.NaN;
  for (let i = 5; i < window.length; i++) {
    if (bt(i) <= MIN_BT) continue;
    const tight = [i - 5, i - 4, i - 3, i - 2, i - 1, i].map(bt);
    if (breaksAfter(tight, MIN_FALL_PER_STEP)) return window[i - 2];
    if (i < 10) continue;
    const loose = [i - 10, i - 8, i - 6, i - 4, i - 2, i].map(bt);
    if (breaksAfter(loose, MIN_FALL_PER_STEP * LOOSE_FACTOR)) return window[i - 4];
  }
  return undefined;
}
