import type { AutoProfile } from '@roastpilot/shared';
import { curveTargetC } from '../../auto/curve';
import { plannedCurve } from '../../auto/steps-curve';
import { timeAtC } from '../../profiles/curve-time';
import { REPORT, type PlanCheck, type ReportPoint, type RoastReport } from './report-types';

const planned = (curve: readonly ReportPoint[], tS: number | undefined) => {
  if (tS === undefined) return undefined;
  const c = curveTargetC(curve, tS);
  return c === undefined ? undefined : { tS, c };
};

/**
 * An Auto roast against its profile's planned curve: when dry end, first crack and drop came
 * against when the plan had them, and how far BT strayed from it. The planned first crack is where
 * its development starts: drop less the development time. Stops at `untilS` (drop, Stop roast or
 * when you took over), and starts a minute past the turning point (the roast's or the plan's,
 * whichever is later): the plan only sketches the dip, bending flat through it.
 */
export function planCheck(
  profile: AutoProfile,
  points: readonly ReportPoint[],
  moments: Pick<RoastReport, 'turningPoint' | 'dryEnd' | 'firstCrack'> & {
    drop: ReportPoint | undefined;
  },
  untilS: number,
): PlanCheck {
  const curve = plannedCurve(profile);
  const dropS = curve.at(-1)?.tS;
  const crackS = dropS === undefined ? undefined : dropS - profile.devTimeS;
  const inTime = (p: ReportPoint | undefined) => (p && p.tS <= untilS ? p : undefined);

  const fromS =
    Math.max(moments.turningPoint?.tS ?? 0, curve.reduce(lowestAt, curve[0])?.tS ?? 0) +
    REPORT.planFromTurnS;
  const toS = Math.min(untilS, dropS ?? untilS);
  let furthest: PlanCheck['furthest'];
  for (const p of points) {
    if (p.tS < fromS || p.tS > toS) continue;
    const target = curveTargetC(curve, p.tS);
    if (target === undefined) continue;
    const byC = p.c - target;
    if (!furthest || Math.abs(byC) > Math.abs(furthest.byC)) furthest = { atS: p.tS, byC };
  }

  const fc = inTime(moments.firstCrack);
  const drop = inTime(moments.drop);
  return {
    dryEnd: {
      actual: inTime(moments.dryEnd),
      plan: planned(curve, timeAtC(curve, profile.dryEndC)),
    },
    firstCrack: { actual: fc, plan: planned(curve, crackS) },
    drop: { actual: drop, plan: planned(curve, dropS) },
    developmentS: {
      actual: fc && drop ? drop.tS - fc.tS : undefined,
      plan: profile.devTimeS,
    },
    furthest,
    untilS,
  };
}

function lowestAt(low: ReportPoint | undefined, p: ReportPoint): ReportPoint {
  return low && low.c <= p.c ? low : p;
}
