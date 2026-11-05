import type { CurvePoint } from '@roastpilot/shared';

/**
 * The curve's temperature at `tS` seconds since charge: straight lines between points, the first
 * point's value before it, and past the last point the last section's slope carried on
 * (docs/spec/roast-control.md, Heat control). Undefined for a curve with too few points.
 */
export function curveTargetC(curve: readonly CurvePoint[], tS: number): number | undefined {
  const [first] = curve;
  if (!first || curve.length < 2) return undefined;
  if (tS <= first.tS) return first.c;
  const afterIndex = curve.findIndex((point) => point.tS >= tS);
  // Past the end, the last two points give the slope.
  const endIndex = afterIndex === -1 ? curve.length - 1 : afterIndex;
  const end = curve[endIndex];
  const start = curve[endIndex - 1];
  if (!start || !end) return undefined;
  return start.c + ((end.c - start.c) * (tS - start.tS)) / (end.tS - start.tS);
}
