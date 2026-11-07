import { describe, expect, it } from 'vitest';
import { curveRorAt, curveTargetC } from './curve';

const CURVE = [
  { tS: 60, c: 100 },
  { tS: 120, c: 130 },
  { tS: 180, c: 140 },
];

describe('curveTargetC', () => {
  it('draws a straight line between two points', () => {
    expect(curveTargetC(CURVE, 90)).toBe(115);
  });

  it('hits a point exactly', () => {
    expect(curveTargetC(CURVE, 120)).toBe(130);
    expect(curveTargetC(CURVE, 180)).toBe(140);
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
  it("is a section's slope in °C/min", () => {
    // 100 → 130 °C over 60 s.
    expect(curveRorAt(CURVE, 90)).toBe(30);
  });

  it('blends the two slopes over ±15 s around a knee', () => {
    // 15 s at 30 °C/min, then 15 s at 10.
    expect(curveRorAt(CURVE, 120)).toBe(20);
  });

  it('carries the last slope on past the end, and is flat before the first point', () => {
    expect(curveRorAt(CURVE, 400)).toBeCloseTo(10);
    expect(curveRorAt(CURVE, 0)).toBe(0);
  });

  it('has none with too few points', () => {
    expect(curveRorAt([], 10)).toBeUndefined();
  });
});
