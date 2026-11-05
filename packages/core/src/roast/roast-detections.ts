import type { Reading, RoastEvent, RoastState } from '@roastpilot/shared';
import { BEAN_TEMP } from '../safety/safety-rule';
import { findChargePoint } from './charge-point';
import { findTurningPoint } from './turning-point';

/** Where the roast clock starts, and how much earlier than the press that is. */
export interface Charge {
  atMs: number;
  bt: number | null;
  earlierMs: number;
}

/**
 * The charge for a Start pressed at `pressedAtMs` (docs/spec/manual-mode.md, Charge point): the
 * reading before the charge drop, looked for since Preheat when `findPoint` is on; else the press.
 */
export function chargeFor(
  state: RoastState,
  readings: readonly Reading[],
  pressedAtMs: number,
  { findPoint, latestBt }: { findPoint: boolean; latestBt: number | undefined },
): Charge {
  const since = state.preheatAtMs ?? Number.NEGATIVE_INFINITY;
  const found = findPoint
    ? findChargePoint(
        readings.filter((r) => r.atMs >= since),
        pressedAtMs,
      )
    : undefined;
  if (!found) return { atMs: pressedAtMs, bt: latestBt ?? null, earlierMs: 0 };
  return {
    atMs: found.atMs,
    bt: found.values[BEAN_TEMP] ?? null,
    earlierMs: pressedAtMs - found.atMs,
  };
}

/**
 * The turning point event, once while roasting (docs/spec/manual-mode.md, Turning point);
 * undefined before it shows, after it is recorded, or outside Roasting.
 */
export function turningPointEvent(
  state: RoastState,
  readings: readonly Reading[],
): RoastEvent | undefined {
  const { phase, chargedAtMs, events } = state;
  if (phase !== 'roasting' || chargedAtMs === null) return undefined;
  if (events.some((e) => e.kind === 'turning-point')) return undefined;
  const found = findTurningPoint(readings, chargedAtMs);
  return found
    ? { kind: 'turning-point', atMs: found.atMs, bt: found.values[BEAN_TEMP] ?? null }
    : undefined;
}
