import type { Reading } from '@roastpilot/shared';
import { BEAN_TEMP } from '../safety/safety-rule';

export const ROR_WINDOW_MS = 30_000;

/**
 * Rate of rise in °C/min: the least-squares slope of BT over the last `windowMs` (docs/spec/roast-control.md).
 * Undefined until the readings span the whole window, so a half-filled window never shows a wild number.
 */
export function rateOfRise(
  readings: readonly Reading[],
  windowMs = ROR_WINDOW_MS,
): number | undefined {
  const latest = readings.at(-1);
  if (!latest) return undefined;
  const startMs = latest.atMs - windowMs;
  const points = readings.flatMap((r) => {
    const bt = r.values[BEAN_TEMP];
    return r.atMs >= startMs && bt !== undefined && Number.isFinite(bt) ? [{ t: r.atMs, bt }] : [];
  });
  const first = points[0];
  if (!first || points.length < 2 || latest.atMs - first.t < windowMs * 0.9) return undefined;
  const meanT = points.reduce((sum, p) => sum + p.t, 0) / points.length;
  const meanBt = points.reduce((sum, p) => sum + p.bt, 0) / points.length;
  const covariance = points.reduce((sum, p) => sum + (p.t - meanT) * (p.bt - meanBt), 0);
  const variance = points.reduce((sum, p) => sum + (p.t - meanT) ** 2, 0);
  return variance === 0 ? undefined : (covariance / variance) * 60_000;
}

/**
 * The readings RoR may use: after charge, only those since charge. The beans going in drop the
 * temperature sharply, so a window reaching back across charge gives a meaningless number
 * (Artisan starts its RoR after charge too).
 */
export function rorReadings(
  readings: readonly Reading[],
  chargedAtMs: number | null,
): readonly Reading[] {
  if (chargedAtMs === null) return readings;
  const first = readings.findIndex((r) => r.atMs >= chargedAtMs);
  return first === -1 ? [] : readings.slice(first);
}

/** RoR is drawn only inside these limits, in °C/min (Artisan's defaults); outside is a gap. */
export const ROR_DRAW_LIMITS = { min: -10, max: 45 } as const;
