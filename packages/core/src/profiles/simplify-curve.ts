import type { CurvePoint } from '@roastpilot/shared';

/** How far `point` is above or below the straight line from `a` to `b`, in °C. */
function offLine(point: CurvePoint, a: CurvePoint, b: CurvePoint): number {
  const span = b.tS - a.tS;
  const onLine = span === 0 ? a.c : a.c + ((b.c - a.c) * (point.tS - a.tS)) / span;
  return Math.abs(point.c - onLine);
}

/**
 * Keeps the first and last point, then repeatedly the point furthest off the lines drawn so far,
 * until there are `maxPoints`.
 */
export function simplifyCurve(points: readonly CurvePoint[], maxPoints: number): CurvePoint[] {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length <= maxPoints) return [...points];
  const kept = [0, points.length - 1];
  while (kept.length < maxPoints) {
    let worst = { index: -1, off: 0 };
    kept.slice(1).forEach((end, i) => {
      const start = kept[i] ?? 0;
      const [a, b] = [points[start], points[end]];
      if (!a || !b) return;
      for (let index = start + 1; index < end; index += 1) {
        const point = points[index];
        const off = point ? offLine(point, a, b) : 0;
        if (off > worst.off) worst = { index, off };
      }
    });
    if (worst.index < 0) break;
    kept.push(worst.index);
    kept.sort((x, y) => x - y);
  }
  return kept.flatMap((index) => points[index] ?? []);
}
