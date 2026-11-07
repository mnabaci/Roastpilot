import type { CurvePoint } from '@roastpilot/shared';

/**
 * Each point's slope for a curve that never overshoots between two points (Fritsch–Butland):
 * flat where the curve turns, a weighted harmonic mean of the two sides elsewhere.
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

/** The cubic Hermite value between `from` and `to` at `tS`. */
function hermite(from: CurvePoint, to: CurvePoint, dFrom: number, dTo: number, tS: number) {
  const h = to.tS - from.tS;
  const t = (tS - from.tS) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * from.c +
    (t3 - 2 * t2 + t) * h * dFrom +
    (-2 * t3 + 3 * t2) * to.c +
    (t3 - t2) * h * dTo
  );
}

/**
 * A smooth curve through `points` (in time order) that never overshoots between two of them,
 * sampled every `stepS` plus each point, in whole degrees (docs/spec/roast-control.md, Milestone
 * builder).
 */
export function monotoneCurve(points: readonly CurvePoint[], stepS: number): CurvePoint[] {
  const d = slopes(points);
  const curve: CurvePoint[] = [];
  points.forEach((to, i) => {
    const from = points[i - 1];
    if (from) {
      const first = Math.floor(from.tS / stepS) + 1;
      for (let tS = first * stepS; tS < to.tS; tS += stepS) {
        const c = hermite(from, to, d[i - 1] ?? 0, d[i] ?? 0, tS);
        curve.push({ tS, c: Math.round(c) });
      }
    }
    curve.push({ tS: to.tS, c: to.c });
  });
  return curve;
}
