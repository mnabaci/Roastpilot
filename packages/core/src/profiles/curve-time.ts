import type { CurvePoint } from '@roastpilot/shared';

/** When a planned curve first climbs through `c`, after its lowest point; undefined if never. */
export function timeAtC(curve: readonly CurvePoint[], c: number): number | undefined {
  const lowest = curve.reduce((min, p, i) => (p.c < (curve[min]?.c ?? Infinity) ? i : min), 0);
  for (let i = lowest + 1; i < curve.length; i++) {
    const from = curve[i - 1];
    const to = curve[i];
    if (from && to && from.c < c && to.c >= c) {
      return from.tS + ((c - from.c) / (to.c - from.c)) * (to.tS - from.tS);
    }
  }
  return undefined;
}
