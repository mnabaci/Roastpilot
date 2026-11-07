import {
  AutoProfileSchema,
  MILESTONE_BACKUP_MARGIN_S,
  MILESTONE_CAP_MARGIN_C,
  type AutoProfile,
  type CurvePoint,
  type Milestones,
  type ProfilePhase,
} from '@roastpilot/shared';
import { timeAtC } from './curve-time';
import { monotoneCurve } from './monotone-curve';

const SAMPLE_EVERY_S = 30;

/** The curve's temperature at `tS`, on the straight line between its points. */
function cAtS(curve: readonly CurvePoint[], tS: number): number {
  const after = curve.findIndex((p) => p.tS >= tS);
  const to = curve[after];
  const from = curve[after - 1];
  if (!to) return curve.at(-1)?.c ?? 0;
  if (!from) return to.c;
  return from.c + ((tS - from.tS) / (to.tS - from.tS)) * (to.c - from.c);
}

/** A curve profile's milestones, for the builder to start from. */
export function milestonesFrom(profile: AutoProfile): Milestones {
  const { curve } = profile;
  const turningPoint = curve.reduce((low, p) => (p.c < low.c ? p : low));
  const drop = curve.at(-1) ?? turningPoint;
  const fcS = drop.tS - profile.devTimeS;
  const dryEndS = timeAtC(curve, profile.dryEndC) ?? (turningPoint.tS + fcS) / 2;
  return {
    chargeC: profile.chargeC,
    turningPoint,
    dryEnd: { tS: Math.round(dryEndS), c: profile.dryEndC },
    firstCrack: { tS: fcS, c: Math.round(cAtS(curve, fcS)) },
    drop,
    extras: [],
  };
}

/**
 * The base's phases on the new curve: a phase that would start at or above the cap goes, the one
 * before it running to the end; every BT trigger's backup is when the curve gets there plus a minute.
 */
function retimed(
  phases: readonly ProfilePhase[],
  curve: readonly CurvePoint[],
  capC: number,
): ProfilePhase[] {
  const dropS = curve.at(-1)?.tS ?? 0;
  const kept: ProfilePhase[] = [];
  let lastBackupS = 0;
  for (const phase of phases) {
    const { next } = phase;
    if (next.on === 'bt' && next.c >= capC) {
      kept.push({ ...phase, next: { on: 'end' } });
      return kept;
    }
    if (next.on !== 'bt') {
      kept.push(phase);
      continue;
    }
    const reachedS = Math.round(timeAtC(curve, next.c) ?? dropS);
    lastBackupS = Math.max(reachedS + MILESTONE_BACKUP_MARGIN_S, lastBackupS + 1);
    kept.push({ ...phase, next: { ...next, backupS: lastBackupS } });
  }
  return kept;
}

/**
 * A new curve profile from your milestones, everything else from `base` (docs/spec/roast-control.md,
 * Milestone builder). The milestones are already valid (`MilestonesSchema`).
 */
export function profileFromMilestones({
  milestones: m,
  base,
  id,
  name,
}: {
  milestones: Milestones;
  base: AutoProfile;
  id: string;
  name: string;
}): AutoProfile {
  const points = [
    { tS: 0, c: m.chargeC },
    m.turningPoint,
    m.dryEnd,
    ...m.extras,
    m.firstCrack,
    m.drop,
  ].sort((a, b) => a.tS - b.tS);
  const curve = monotoneCurve(points, SAMPLE_EVERY_S);
  const capC = m.drop.c + MILESTONE_CAP_MARGIN_C;
  return AutoProfileSchema.parse({
    ...base,
    source: undefined,
    id,
    name,
    chargeC: m.chargeC,
    dryEndC: m.dryEnd.c,
    devTimeS: m.drop.tS - m.firstCrack.tS,
    capC,
    curve,
    phases: retimed(base.phases, curve, capC),
  });
}
