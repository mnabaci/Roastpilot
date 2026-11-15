import type { RoastDetail, SavedEvent } from '@roastpilot/shared';
import { planCheck } from './plan-check';
import { keyMoments, reportPhases } from './report-phases';
import {
  needsAttention,
  REPORT,
  type ReportFinding,
  type ReportPoint,
  type RoastReport,
} from './report-types';
import { findCrash, findFlick, findStall } from './ror-findings';
import { btAt, btPoints, readingGaps, rorSeries } from './ror-series';

const eventOf = (detail: RoastDetail, kind: SavedEvent['kind']) =>
  detail.events.find((e) => e.kind === kind);

/** When you took an Auto roast over: Manual on, or a slider moved; undefined on a Manual roast. */
function tookOverS(detail: RoastDetail): number | undefined {
  if (detail.mode !== 'auto') return undefined;
  return detail.events.find(
    (e) => (e.kind === 'mode' && e.detail === 'manual') || e.kind === 'override',
  )?.tS;
}

/**
 * The report on a finished roast (docs/spec/roast-report.md): its phases, what RoR did, an Auto
 * roast against its plan, and what to look at. Undefined until it has dropped or been stopped,
 * and for a roast too short or too sparse to measure.
 */
export function roastReport(detail: RoastDetail): RoastReport | undefined {
  const drop = eventOf(detail, 'drop');
  const dropS = detail.dropTimeS ?? drop?.tS;
  const stopS = eventOf(detail, 'end')?.tS;
  const endS = dropS ?? stopS;
  if (endS === undefined || endS < REPORT.minRoastS) return undefined;

  const points = btPoints(detail.samples);
  const roast = points.filter((p) => p.tS >= 0 && p.tS <= endS);
  if (roast.length < REPORT.minReadings) return undefined;

  const moments = keyMoments(detail, points, endS);
  const series = rorSeries(roast);
  const crackS = moments.firstCrack?.tS;
  const takeOverS = tookOverS(detail);
  const findings: ReportFinding[] = [];

  for (const gap of readingGaps(roast)) findings.push({ kind: 'gap', ...gap });

  if (crackS !== undefined && dropS !== undefined) {
    const crash = findCrash(series, crackS, dropS);
    const flick = findFlick(series, crackS, dropS);
    if (crash) findings.push(crash);
    if (flick) findings.push(flick);
    // Judged as shown, a whole percentage: 9.96 % reads 10 % and isn't short.
    const share = (dropS - crackS) / dropS;
    const shown = Math.round(share * 100) / 100;
    if (shown < REPORT.shortDevelopmentShare)
      findings.push({ kind: 'development-share', share, side: 'short' });
    else if (shown > REPORT.longDevelopmentShare)
      findings.push({ kind: 'development-share', share, side: 'long' });
  }

  // Stalls count from dry end (or a minute and a half past the turning point) to first crack.
  const stallFromS = moments.dryEnd?.tS ?? (moments.turningPoint?.tS ?? 0) + 90;
  const trips = detail.events
    .filter((e) => e.kind === 'stall-guard' && e.detail !== 'cleared')
    .map((e) => e.tS);
  const stall = findStall(series, stallFromS, crackS ?? endS, trips);
  if (stall) findings.push(stall);
  else if (trips[0] !== undefined)
    findings.push({ kind: 'stall-guard', atS: trips[0], times: trips.length });

  if (dropS === undefined && stopS !== undefined) findings.push({ kind: 'stopped', atS: stopS });
  else if (crackS === undefined) findings.push({ kind: 'no-first-crack' });
  if (takeOverS !== undefined && takeOverS < endS)
    findings.push({ kind: 'took-over', atS: takeOverS });

  const dropPoint = dropS === undefined ? undefined : dropAt(detail, points, dropS);
  const { profile } = detail;
  const plan =
    detail.mode === 'auto' && profile
      ? planCheck(
          profile,
          roast,
          { ...moments, drop: dropPoint },
          Math.min(endS, takeOverS ?? endS),
        )
      : undefined;
  if (plan?.furthest && Math.abs(plan.furthest.byC) >= REPORT.offPlanC)
    findings.push({ kind: 'off-plan', ...plan.furthest });

  // Auto drops at the BT cap whatever the time: say so when it cut development short.
  if (profile && detail.mode === 'auto' && dropPoint && crackS !== undefined) {
    const shortS = profile.devTimeS - (dropPoint.tS - crackS);
    if (shortS > REPORT.devShortfallS && dropPoint.c >= profile.capC - REPORT.capSlackC)
      findings.push({ kind: 'cap-drop', atS: dropPoint.tS, capC: profile.capC, shortS });
  }

  const btAtEnd = dropPoint?.c ?? btAt(points, endS);
  return {
    endS,
    end: btAtEnd === undefined ? undefined : { tS: endS, c: btAtEnd },
    stopped: dropS === undefined,
    phases: reportPhases(moments, endS),
    ...moments,
    plan,
    findings: sortFindings(findings),
  };
}

/** Drop with its temperature: as saved, else from its event, else read from the samples. */
function dropAt(
  detail: RoastDetail,
  points: readonly ReportPoint[],
  dropS: number,
): ReportPoint | undefined {
  const c = detail.dropTemp ?? eventOf(detail, 'drop')?.bt ?? btAt(points, dropS);
  return c === undefined ? undefined : { tS: dropS, c };
}

const timeOf = (f: ReportFinding): number =>
  'atS' in f ? f.atS : 'fromS' in f ? f.fromS : Number.POSITIVE_INFINITY;

/** What to look at first, then notes, each in time order (timeless ones last). */
function sortFindings(findings: ReportFinding[]): ReportFinding[] {
  return [...findings].sort(
    (a, b) => Number(needsAttention(b)) - Number(needsAttention(a)) || timeOf(a) - timeOf(b),
  );
}
