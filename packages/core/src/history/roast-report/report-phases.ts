import type { RoastDetail, SavedEvent } from '@roastpilot/shared';
import { DEFAULT_DRY_END_C } from '../../chart/phase-bands';
import type { ReportPhase, ReportPoint, RoastReport } from './report-types';
import { btAt } from './ror-series';

const eventOf = (detail: RoastDetail, kind: SavedEvent['kind']) =>
  detail.events.find((e) => e.kind === kind);

/** A moment from its event: BT as recorded, else read from the samples around it. */
function momentAt(
  points: readonly ReportPoint[],
  tS: number,
  bt: number | null | undefined,
): ReportPoint | undefined {
  const c = bt ?? btAt(points, tS);
  return c === undefined ? undefined : { tS, c };
}

/** The lowest BT in the first three minutes after charge, when no turning point was marked. */
function lowestEarly(points: readonly ReportPoint[]): ReportPoint | undefined {
  return points
    .filter((p) => p.tS >= 0 && p.tS <= 180)
    .reduce<ReportPoint | undefined>((low, p) => (low && low.c <= p.c ? low : p), undefined);
}

/**
 * Turning point, dry end and first crack, inside charge to `endS`. A moment out of order (a first
 * crack after drop, a dry end after first crack) is left out rather than trusted.
 */
export function keyMoments(
  detail: RoastDetail,
  points: readonly ReportPoint[],
  endS: number,
): Pick<RoastReport, 'turningPoint' | 'dryEnd' | 'firstCrack'> {
  const inside = (tS: number | null | undefined): tS is number =>
    tS !== null && tS !== undefined && tS > 0 && tS < endS;

  const fcEvent = eventOf(detail, 'first-crack');
  const fcS = detail.fcTimeS ?? fcEvent?.tS;
  const firstCrack = inside(fcS) ? momentAt(points, fcS, detail.fcTemp ?? fcEvent?.bt) : undefined;
  const limitS = firstCrack?.tS ?? endS;

  const tpEvent = eventOf(detail, 'turning-point');
  const turningPoint =
    tpEvent && inside(tpEvent.tS) && tpEvent.tS < limitS
      ? momentAt(points, tpEvent.tS, tpEvent.bt)
      : lowestEarly(points.filter((p) => p.tS < limitS));

  const dryEvent = eventOf(detail, 'dry-end');
  if (dryEvent && inside(dryEvent.tS) && dryEvent.tS < limitS) {
    const marked = momentAt(points, dryEvent.tS, dryEvent.bt);
    if (marked) return { turningPoint, firstCrack, dryEnd: { ...marked, estimated: false } };
  }
  // No mark (Manual, an imported roast): where BT first climbs through the dry-end temperature.
  const dryEndC = detail.profile?.dryEndC ?? DEFAULT_DRY_END_C;
  const fromS = turningPoint?.tS ?? 0;
  const crossed = points.find((p) => p.tS > fromS && p.tS < limitS && p.c >= dryEndC);
  return {
    turningPoint,
    firstCrack,
    dryEnd: crossed ? { ...crossed, estimated: true } : undefined,
  };
}

/** Drying, Maillard and Development as parts of charge to `endS`; what can be placed. */
export function reportPhases(
  { dryEnd, firstCrack }: Pick<RoastReport, 'dryEnd' | 'firstCrack'>,
  endS: number,
): ReportPhase[] {
  const phase = (kind: ReportPhase['kind'], fromS: number, toS: number): ReportPhase => ({
    kind,
    fromS,
    toS,
    share: (toS - fromS) / endS,
  });
  const crackS = firstCrack?.tS;
  const development = crackS === undefined ? [] : [phase('development', crackS, endS)];
  if (dryEnd)
    return [
      phase('drying', 0, dryEnd.tS),
      phase('maillard', dryEnd.tS, crackS ?? endS),
      ...development,
    ];
  return crackS === undefined ? [] : [phase('before-crack', 0, crackS), ...development];
}
