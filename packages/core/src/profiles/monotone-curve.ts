import type { CurvePoint } from '@roastpilot/shared';

/**
 * Each point's slope for a curve that never overshoots between two points (Fritsch–Butland):
 * flat where the curve turns, a weighted harmonic mean of the two sides elsewhere, and at either
 * end the slope of the section it ends.
 */
function slopes(points: readonly CurvePoint[]): number[] {
  const secants = points.slice(1).map((p, i) => {
    const from = points[i] ?? p;
    return (p.c - from.c) / (p.tS - from.tS);
  });
  return points.map((_, i) => {
    const before = secants[i - 1];
    const after = secants[i];
    if (before === undefined) return after ?? 0;
    if (after === undefined) return before;
    if (before * after <= 0) return 0;
    const hBefore = (points[i]?.tS ?? 0) - (points[i - 1]?.tS ?? 0);
    const hAfter = (points[i + 1]?.tS ?? 0) - (points[i]?.tS ?? 0);
    const wBefore = 2 * hAfter + hBefore;
    const wAfter = hAfter + 2 * hBefore;
    return (wBefore + wAfter) / (wBefore / before + wAfter / after);
  });
}

/** Slopes worked out once per curve: Auto reads the curve every second. */
const slopesByCurve = new WeakMap<readonly CurvePoint[], number[]>();

/** The slope (°C/s) the smooth curve has at each of its points. */
export function pointSlopes(points: readonly CurvePoint[]): readonly number[] {
  const known = slopesByCurve.get(points);
  if (known) return known;
  const found = slopes(points);
  slopesByCurve.set(points, found);
  return found;
}

/** The cubic Hermite value (°C) and slope (°C/s) between `from` and `to` at `tS`. */
function hermite(from: CurvePoint, to: CurvePoint, dFrom: number, dTo: number, tS: number) {
  const h = to.tS - from.tS;
  const t = (tS - from.tS) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const c =
    (2 * t3 - 3 * t2 + 1) * from.c +
    (t3 - 2 * t2 + t) * h * dFrom +
    (-2 * t3 + 3 * t2) * to.c +
    (t3 - t2) * h * dTo;
  const slope =
    ((6 * t2 - 6 * t) * (from.c - to.c)) / h +
    (3 * t2 - 4 * t + 1) * dFrom +
    (3 * t2 - 2 * t) * dTo;
  return { c, slope };
}

/**
 * The smooth curve through `points` (in time order, at least two) at `tS` within them: its
 * temperature and slope in °C/s. Exact at each point, never past either neighbour between two.
 */
export function monotoneAt(
  points: readonly CurvePoint[],
  tS: number,
): { c: number; slope: number } | undefined {
  const d = pointSlopes(points);
  const after = points.findIndex((point) => point.tS >= tS);
  const i = after === -1 ? points.length - 1 : Math.max(1, after);
  const from = points[i - 1];
  const to = points[i];
  if (!from || !to) return undefined;
  return hermite(from, to, d[i - 1] ?? 0, d[i] ?? 0, tS);
}

/**
 * The smooth curve through `points` (in time order) sampled every `stepS` plus each point
 * (docs/spec/roast-control.md, Profile format). Throws for a `stepS` that is not above 0.
 */
export function sampleMonotone(points: readonly CurvePoint[], stepS: number): CurvePoint[] {
  // A programmer error: a step of 0 or less would never reach the next point.
  if (!(stepS > 0)) throw new RangeError(`stepS must be above 0, got ${String(stepS)}`);
  const curve: CurvePoint[] = [];
  points.forEach((to, i) => {
    const from = points[i - 1];
    if (from) {
      const first = Math.floor(from.tS / stepS) + 1;
      for (let tS = first * stepS; tS < to.tS; tS += stepS) {
        const at = monotoneAt(points, tS);
        if (at) curve.push({ tS, c: at.c });
      }
    }
    curve.push({ tS: to.tS, c: to.c });
  });
  return curve;
}

/**
 * A smooth curve through `points` (in time order) that never overshoots between two of them,
 * sampled every `stepS` plus each point, in whole degrees (docs/spec/roast-control.md, Milestone
 * builder).
 */
export function monotoneCurve(points: readonly CurvePoint[], stepS: number): CurvePoint[] {
  return sampleMonotone(points, stepS).map((p) => ({ tS: p.tS, c: Math.round(p.c) }));
}
