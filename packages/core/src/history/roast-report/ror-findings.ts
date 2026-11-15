import { REPORT, type ReportFinding } from './report-types';
import type { RorPoint } from './ror-series';

type Crash = Extract<ReportFinding, { kind: 'crash' }>;
type Flick = Extract<ReportFinding, { kind: 'flick' }>;
type Stall = Extract<ReportFinding, { kind: 'stall' }>;

const between = (series: readonly RorPoint[], fromS: number, toS: number) =>
  series.filter((p) => p.tS >= fromS && p.tS <= toS);

/**
 * RoR crashed after first crack: it fell by half or more, and by at least 4 °C/min, inside a
 * minute. A steady ease-off to drop is the plan and never counts. The first one found.
 */
export function findCrash(
  series: readonly RorPoint[],
  firstCrackS: number,
  endS: number,
): Crash | undefined {
  const after = between(series, firstCrackS, endS);
  for (const point of after) {
    const recent = between(after, point.tS - REPORT.crashWithinS, point.tS);
    const peak = recent.reduce((top, p) => (p.ror > top.ror ? p : top), point);
    const fall = peak.ror - point.ror;
    if (fall >= REPORT.crashMinFallRor && fall >= peak.ror * REPORT.crashFallShare)
      return { kind: 'crash', atS: peak.tS, fromRor: peak.ror, toRor: lowestFrom(after, point) };
  }
  return undefined;
}

/** How low RoR went once it started falling at `from`, until it rose again. */
function lowestFrom(series: readonly RorPoint[], from: RorPoint): number {
  let low = from.ror;
  for (const p of series.filter((q) => q.tS > from.tS)) {
    if (p.ror > low) break;
    low = p.ror;
  }
  return low;
}

/**
 * RoR flicked up before drop: after first crack (past its own bump) it rose 1.5 °C/min or more
 * above the lowest it had been, and stayed up 15 s. The first one found.
 */
export function findFlick(
  series: readonly RorPoint[],
  firstCrackS: number,
  endS: number,
): Flick | undefined {
  const after = between(series, firstCrackS + REPORT.flickFromCrackS, endS);
  let low: RorPoint | undefined;
  let run: { from: RorPoint; top: number } | undefined;
  for (const p of after) {
    if (!low) {
      low = p;
      continue;
    }
    if (p.ror < low.ror + REPORT.flickRiseRor) {
      run = undefined;
      if (p.ror < low.ror) low = p;
      continue;
    }
    run = run ? { from: run.from, top: Math.max(run.top, p.ror) } : { from: p, top: p.ror };
    if (p.tS - run.from.tS >= REPORT.flickHoldS)
      return { kind: 'flick', atS: run.from.tS, fromRor: low.ror, toRor: run.top };
  }
  return undefined;
}

/**
 * RoR stalled before first crack (or drop): under 3 °C/min for 30 s or more, from `fromS` on.
 * `guardedAt` are the times Auto's stall guard tripped. The longest one.
 */
export function findStall(
  series: readonly RorPoint[],
  fromS: number,
  toS: number,
  guardedAt: readonly number[],
): Stall | undefined {
  let longest: Stall | undefined;
  let run: RorPoint[] = [];
  const close = () => {
    const first = run[0];
    const last = run.at(-1);
    if (first && last && last.tS - first.tS >= REPORT.stallHoldS) {
      const durationS = last.tS - first.tS;
      if (!longest || durationS > longest.durationS)
        longest = {
          kind: 'stall',
          atS: first.tS,
          durationS,
          minRor: Math.min(...run.map((p) => p.ror)),
          guarded: guardedAt.some((t) => t >= first.tS - REPORT.stallHoldS && t <= last.tS),
        };
    }
    run = [];
  };
  for (const p of between(series, fromS, toS)) {
    if (p.ror < REPORT.stallRor) run.push(p);
    else close();
  }
  close();
  return longest;
}
