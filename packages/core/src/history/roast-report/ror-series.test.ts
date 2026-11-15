import { describe, expect, it } from 'vitest';
import { btAt, btPoints, readingGaps, rorSeries } from './ror-series';

const line = (fromS: number, toS: number, rorPerMin: number, startC = 100) =>
  Array.from({ length: toS - fromS + 1 }, (_, i) => ({
    tS: fromS + i,
    c: startC + (rorPerMin / 60) * i,
  }));

describe('btPoints', () => {
  it('keeps finite BT readings in time order and drops the rest', () => {
    const points = btPoints([
      { tS: 2, values: { bt: 102 } },
      { tS: 0, values: { bt: 100 } },
      { tS: 1, values: { et: 200 } },
      { tS: 3, values: { bt: Number.NaN } },
    ]);
    expect(points).toEqual([
      { tS: 0, c: 100 },
      { tS: 2, c: 102 },
    ]);
  });
});

describe('btAt', () => {
  const points = [
    { tS: 0, c: 100 },
    { tS: 10, c: 110 },
  ];

  it('reads between two readings', () => {
    expect(btAt(points, 5)).toBe(105);
    expect(btAt(points, 10)).toBe(110);
  });

  it('is undefined outside them', () => {
    expect(btAt(points, -1)).toBeUndefined();
    expect(btAt(points, 11)).toBeUndefined();
  });
});

describe('rorSeries', () => {
  it('is the slope of BT in °C/min once 30 s of readings are in', () => {
    const series = rorSeries(line(0, 90, 12));
    expect(series[0]?.tS).toBeGreaterThanOrEqual(27);
    for (const p of series) expect(p.ror).toBeCloseTo(12, 6);
  });

  it('starts at charge: preheat readings never count', () => {
    const series = rorSeries([...line(-60, -1, -30, 200), ...line(0, 60, 10)]);
    expect(series.every((p) => p.tS >= 27 && Math.abs(p.ror - 10) < 1e-6)).toBe(true);
  });

  it('has no point whose window reaches across a gap', () => {
    const points = [...line(0, 60, 10), ...line(75, 140, 10, 112.5)];
    const series = rorSeries(points);
    expect(series.some((p) => p.tS > 60 && p.tS < 75 + 27)).toBe(false);
    expect(series.some((p) => p.tS > 75 + 30)).toBe(true);
  });
});

describe('readingGaps', () => {
  it('finds stretches of more than 10 s without a reading', () => {
    expect(readingGaps([...line(0, 20, 10), ...line(25, 30, 10), ...line(45, 50, 10)])).toEqual([
      { fromS: 30, toS: 45 },
    ]);
  });
});
