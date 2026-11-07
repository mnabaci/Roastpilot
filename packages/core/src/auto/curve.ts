import type { CurvePoint } from '@roastpilot/shared';
import { monotoneAt, pointSlopes, sampleMonotone } from '../profiles/monotone-curve';

/**
 * Where the curve is at `tS` seconds since charge, in °C and °C/s: a smooth curve through its
 * points that never overshoots between two (Fritsch–Butland), the first point's value before it,
 * and past the last point the last section's slope carried on, which is also the smooth curve's
 * slope there (docs/spec/roast-control.md, Heat control). Undefined with too few points.
 */
function curveAt(
  curve: readonly CurvePoint[],
  tS: number,
): { c: number; slope: number } | undefined {
  const first = curve[0];
  const last = curve.at(-1);
  if (!first || !last || curve.length < 2) return undefined;
  if (tS <= first.tS) return { c: first.c, slope: 0 };
  if (tS <= last.tS) return monotoneAt(curve, tS);
  const slope = pointSlopes(curve).at(-1) ?? 0;
  return { c: last.c + slope * (tS - last.tS), slope };
}

/** The curve's temperature at `tS` seconds since charge (see `curveAt`). */
export function curveTargetC(curve: readonly CurvePoint[], tS: number): number | undefined {
  return curveAt(curve, tS)?.c;
}

/** The curve's own rate of rise at `tS`, in °C/min: the smooth curve's slope, with no steps. */
export function curveRorAt(curve: readonly CurvePoint[], tS: number): number | undefined {
  const at = curveAt(curve, tS);
  return at === undefined ? undefined : at.slope * 60;
}

/**
 * The curve as the chart draws it: sampled every `stepS` between its points, so the dashed plan is
 * the same smooth curve Auto follows. A curve with too few points is returned as it is.
 */
export function smoothCurve(curve: readonly CurvePoint[], stepS: number): readonly CurvePoint[] {
  return curve.length < 2 ? curve : sampleMonotone(curve, stepS);
}
