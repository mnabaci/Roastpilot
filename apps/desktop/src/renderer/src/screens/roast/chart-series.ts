import { rateOfRise, ROR_DRAW_LIMITS, ROR_WINDOW_MS } from '@roastpilot/core';
import type { Reading } from '@roastpilot/shared';
import type { ChartPoint } from '@roastpilot/ui';

/** Readings further apart than this are a break in every line (the lost-connection limit). */
const GAP_MS = 3_000;

/** A channel's value at each reading that has it. */
export function channelPoints(
  readings: readonly Reading[],
  channel: string,
  toT: (atMs: number) => number,
): ChartPoint[] {
  return readings.flatMap((r) => {
    const v = r.values[channel];
    return v === undefined ? [] : [{ t: toT(r.atMs), v }];
  });
}

/** Times of the breaks: halfway between readings more than GAP_MS apart. */
export function breakTimes(readings: readonly Reading[]): number[] {
  return readings.flatMap((r, i) => {
    const previous = readings[i - 1];
    return previous && r.atMs - previous.atMs > GAP_MS ? [(previous.atMs + r.atMs) / 2] : [];
  });
}

/** Adds a null point at each break, so the line stops there instead of joining across it. */
export function withBreaks(points: ChartPoint[], breaks: readonly number[]): ChartPoint[] {
  if (breaks.length === 0) return points;
  return [...points, ...breaks.map((t) => ({ t, v: null }))].sort((a, b) => a.t - b.t);
}

/**
 * The drawn temperature: a weighted average of the readings in the last `windowS` seconds, newest
 * counting most (weights 1, 2, 3, …), restarting after a break. Like Artisan's curve filter, it
 * smooths jitter with about half the lag of a plain average. 0 draws the raw readings
 * (docs/spec/ui.md, Temperature axis).
 */
export function smoothed(points: readonly ChartPoint[], windowS: number): ChartPoint[] {
  if (windowS <= 0) return [...points];
  let start = 0;
  return points.map((point, i) => {
    if (point.v === null) {
      start = i + 1;
      return point;
    }
    while (start < i && (points[start]?.t ?? Infinity) <= point.t - windowS) start++;
    let sum = 0;
    let weights = 0;
    for (let k = start; k <= i; k++) {
      const weight = k - start + 1;
      sum += (points[k]?.v ?? 0) * weight;
      weights += weight;
    }
    return { t: point.t, v: sum / weights };
  });
}

/** RoR at each reading, from only the readings in its window, so the series stays O(n). */
export function rorPoints(
  readings: readonly Reading[],
  toT: (atMs: number) => number,
): ChartPoint[] {
  const points: ChartPoint[] = [];
  let start = 0;
  readings.forEach((reading, i) => {
    while ((readings[start]?.atMs ?? Infinity) < reading.atMs - ROR_WINDOW_MS) start++;
    const ror = rateOfRise(readings.slice(start, i + 1));
    if (ror === undefined) return;
    // Outside the limits is a gap, not a spike that stretches the axis.
    const shown = ror >= ROR_DRAW_LIMITS.min && ror <= ROR_DRAW_LIMITS.max;
    points.push({ t: toT(reading.atMs), v: shown ? ror : null });
  });
  return points;
}
