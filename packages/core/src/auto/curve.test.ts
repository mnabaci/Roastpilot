import type { CurvePoint } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { curveRorAt, curveTargetC, smoothCurve } from './curve';

const CURVE = [
  { tS: 60, c: 100 },
  { tS: 120, c: 130 },
  { tS: 180, c: 140 },
];

/** Light · Curve's points (packages/drivers, Skywalker profiles). */
const LIGHT: readonly CurvePoint[] = [
  { tS: 0, c: 180 },
  { tS: 64, c: 92 },
  { tS: 154, c: 110 },
  { tS: 305, c: 150 },
  { tS: 379, c: 165 },
  { tS: 477, c: 180 },
  { tS: 558, c: 190 },
  { tS: 663, c: 197 },
];

describe('curveTargetC', () => {
  it('bends smoothly between two points rather than drawing a straight line', () => {
    // A straight line gives 115; the curve still carries the first section's pace.
    expect(curveTargetC(CURVE, 90)).toBeCloseTo(116.875);
  });

  it('hits every point exactly', () => {
    for (const curve of [CURVE, LIGHT]) {
      for (const point of curve) expect(curveTargetC(curve, point.tS)).toBeCloseTo(point.c, 9);
    }
  });

  it('never overshoots between two points', () => {
    for (let i = 1; i < LIGHT.length; i++) {
      const from = LIGHT[i - 1];
      const to = LIGHT[i];
      if (!from || !to) continue;
      for (let tS = from.tS; tS <= to.tS; tS++) {
        const c = curveTargetC(LIGHT, tS) ?? Number.NaN;
        expect(c).toBeGreaterThanOrEqual(Math.min(from.c, to.c) - 1e-9);
        expect(c).toBeLessThanOrEqual(Math.max(from.c, to.c) + 1e-9);
      }
    }
  });

  it('holds the first value before the first point', () => {
    expect(curveTargetC(CURVE, 0)).toBe(100);
  });

  it('carries on along the last slope past the end', () => {
    expect(curveTargetC(CURVE, 240)).toBe(150);
  });

  it('has no target with too few points', () => {
    expect(curveTargetC([], 10)).toBeUndefined();
    expect(curveTargetC([{ tS: 0, c: 100 }], 10)).toBeUndefined();
  });
});

describe('curveRorAt', () => {
  it("is the smooth curve's slope in °C/min", () => {
    // Between 30 (100 → 130 °C over 60 s) and the slope at 2:00.
    expect(curveRorAt(CURVE, 90)).toBeCloseTo(33.75);
    // At a point it is the harmonic blend of both sides' 30 and 10.
    expect(curveRorAt(CURVE, 120)).toBeCloseTo(15);
  });

  it('has no step at any point: the slope just before equals the slope just after', () => {
    for (const point of LIGHT.slice(1)) {
      const before = curveRorAt(LIGHT, point.tS - 1e-4) ?? Number.NaN;
      const after = curveRorAt(LIGHT, point.tS + 1e-4) ?? Number.NaN;
      expect(after).toBeCloseTo(before, 2);
    }
  });

  it('is flat at the turning point', () => {
    expect(curveRorAt(LIGHT, 64)).toBe(0);
  });

  it("declines smoothly through Light · Curve's middle and development", () => {
    const at = [180, 330, 510].map((tS) => curveRorAt(LIGHT, tS) ?? Number.NaN);
    expect(at[0]).toBeCloseTo(15.5, 1);
    expect(at[1]).toBeCloseTo(12.7, 1);
    expect(at[2]).toBeCloseTo(8.0, 1);
  });

  it('carries the last slope on past the end, and is flat before the first point', () => {
    expect(curveRorAt(CURVE, 180)).toBeCloseTo(10);
    expect(curveRorAt(CURVE, 400)).toBeCloseTo(10);
    expect(curveRorAt(CURVE, 0)).toBe(0);
  });

  it('has none with too few points', () => {
    expect(curveRorAt([], 10)).toBeUndefined();
  });
});

describe('smoothCurve', () => {
  it('samples the same curve Auto follows, keeping every point', () => {
    const drawn = smoothCurve(CURVE, 30);
    expect(drawn.map((p) => p.tS)).toEqual([60, 90, 120, 150, 180]);
    for (const p of drawn) expect(p.c).toBeCloseTo(curveTargetC(CURVE, p.tS) ?? Number.NaN, 9);
  });

  it('returns a curve with too few points as it is', () => {
    const one = [{ tS: 0, c: 100 }];
    expect(smoothCurve(one, 5)).toBe(one);
  });
});
