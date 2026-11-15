import type { Reading, SavedSample } from '@roastpilot/shared';
import { rateOfRise, ROR_WINDOW_MS } from '../../roast/rate-of-rise';
import { BEAN_TEMP } from '../../safety/safety-rule';
import { REPORT, type ReportPoint } from './report-types';

/** A RoR reading: °C/min at `tS`. */
export interface RorPoint {
  tS: number;
  ror: number;
}

/** BT readings, in time order, with a finite value. */
export function btPoints(samples: readonly SavedSample[]): ReportPoint[] {
  return samples
    .flatMap((s) => {
      const c = s.values[BEAN_TEMP];
      return c !== undefined && Number.isFinite(c) ? [{ tS: s.tS, c }] : [];
    })
    .sort((a, b) => a.tS - b.tS);
}

/** BT at `tS`, between the two readings around it; undefined outside them. */
export function btAt(points: readonly ReportPoint[], tS: number): number | undefined {
  const after = points.findIndex((p) => p.tS >= tS);
  if (after === -1) return undefined;
  const to = points[after];
  const from = points[after - 1];
  if (!to) return undefined;
  if (to.tS === tS || !from) return to.tS === tS ? to.c : undefined;
  return from.c + ((tS - from.tS) / (to.tS - from.tS)) * (to.c - from.c);
}

/** Stretches with no reading for longer than REPORT.maxGapS. */
export function readingGaps(points: readonly ReportPoint[]): { fromS: number; toS: number }[] {
  return points.flatMap((p, i) => {
    const before = points[i - 1];
    return before && p.tS - before.tS > REPORT.maxGapS ? [{ fromS: before.tS, toS: p.tS }] : [];
  });
}

/**
 * RoR through the roast, worked out as the Roast screen does live (the 30 s least-squares slope of
 * BT), from charge on. No point where its window would reach across a gap in the readings.
 */
export function rorSeries(points: readonly ReportPoint[]): RorPoint[] {
  const roast = points.filter((p) => p.tS >= 0);
  const readings: Reading[] = roast.map((p) => ({
    atMs: p.tS * 1000,
    values: { [BEAN_TEMP]: p.c },
  }));
  const windowS = ROR_WINDOW_MS / 1000;
  const series: RorPoint[] = [];
  let start = 0;
  roast.forEach((p, i) => {
    while ((roast[start]?.tS ?? p.tS) < p.tS - windowS) start++;
    for (let j = start + 1; j <= i; j++) {
      const a = roast[j - 1];
      const b = roast[j];
      // A gap inside the window: its slope would draw a line across readings that never came.
      if (a && b && b.tS - a.tS > REPORT.maxGapS) return;
    }
    const ror = rateOfRise(readings.slice(start, i + 1));
    if (ror !== undefined) series.push({ tS: p.tS, ror });
  });
  return series;
}
