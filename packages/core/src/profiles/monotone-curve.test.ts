import type { CurvePoint } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { monotoneCurve } from './monotone-curve';

const MILESTONES: CurvePoint[] = [
  { tS: 0, c: 180 },
  { tS: 64, c: 92 },
  { tS: 305, c: 150 },
  { tS: 558, c: 190 },
  { tS: 663, c: 197 },
];

describe('monotoneCurve', () => {
  const curve = monotoneCurve(MILESTONES, 30);

  it('passes through every point', () => {
    for (const point of MILESTONES) expect(curve).toContainEqual(point);
  });

  it('samples every 30 s between them, going forward in time', () => {
    expect(curve.slice(0, 4).map((p) => p.tS)).toEqual([0, 30, 60, 64]);
    expect(curve.map((p) => p.tS)).toEqual([...curve.map((p) => p.tS)].sort((a, b) => a - b));
    expect(curve).toHaveLength(MILESTONES.length + 22);
  });

  it('never overshoots between two points', () => {
    for (let i = 1; i < MILESTONES.length; i++) {
      const from = MILESTONES[i - 1];
      const to = MILESTONES[i];
      if (!from || !to) continue;
      const between = curve.filter((p) => p.tS > from.tS && p.tS < to.tS);
      for (const p of between) {
        expect(p.c).toBeGreaterThanOrEqual(Math.min(from.c, to.c));
        expect(p.c).toBeLessThanOrEqual(Math.max(from.c, to.c));
      }
    }
  });

  it('bottoms out at the turning point and climbs after it', () => {
    const lowest = curve.reduce((low, p) => (p.c < low.c ? p : low));
    expect(lowest).toEqual({ tS: 64, c: 92 });
    const after = curve.filter((p) => p.tS >= 64);
    after.slice(1).forEach((p, i) => {
      expect(p.c).toBeGreaterThanOrEqual(after[i]?.c ?? 0);
    });
  });

  it('bends rather than drawing straight lines', () => {
    // A straight line from 150 °C at 5:05 to 190 °C at 9:18 is 159 °C at 6:00; the curve, still
    // climbing fast from the dry end, is warmer.
    expect(curve.find((p) => p.tS === 360)?.c).toBe(160);
  });

  it('keeps whole degrees, and two points as they are', () => {
    expect(curve.every((p) => Number.isInteger(p.c))).toBe(true);
    const two = [
      { tS: 0, c: 100 },
      { tS: 20, c: 120 },
    ];
    expect(monotoneCurve(two, 30)).toEqual(two);
  });
});
