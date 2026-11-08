import { z } from 'zod';
import { CurvePointSchema, PROFILE_LIMITS, type CurvePoint } from './profile';
import { tempInText } from './units';

/** The BT cap sits this far above the drop (docs/spec/roast-control.md, Milestone builder). */
export const MILESTONE_CAP_MARGIN_C = 3;
/** A phase's backup comes this long after the curve reaches its trigger. */
export const MILESTONE_BACKUP_MARGIN_S = 60;

/** The hottest drop: the cap's limit less its margin (232 °C, shown as 450 °F). */
export const MILESTONE_MAX_DROP_C = PROFILE_LIMITS.capC.max - MILESTONE_CAP_MARGIN_C;
const MAX_DROP_S = PROFILE_LIMITS.backupS.max - MILESTONE_BACKUP_MARGIN_S;

const mmss = (s: number) => `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, '0')}`;

type Ctx = z.RefinementCtx;
type Named = CurvePoint & { path: (string | number)[] };

function issue(ctx: Ctx, path: (string | number)[], message: string) {
  ctx.addIssue({ code: 'custom', path, message });
}

/** The five milestones in order, each after the one before. True when they are. */
function forwardInTime(m: Milestones, ctx: Ctx): boolean {
  const steps = [
    ['dryEnd', m.turningPoint, m.dryEnd, 'the turning point'],
    ['firstCrack', m.dryEnd, m.firstCrack, 'dry end'],
    ['drop', m.firstCrack, m.drop, 'first crack'],
  ] as const;
  let forward = true;
  for (const [key, before, point, name] of steps) {
    if (point.tS > before.tS) continue;
    issue(ctx, [key, 'tS'], `After ${name} (${mmss(before.tS)})`);
    forward = false;
  }
  return forward;
}

function limits(m: Milestones, ctx: Ctx) {
  const { min, max } = PROFILE_LIMITS.chargeC;
  if (m.chargeC < min || m.chargeC > max) {
    issue(ctx, ['chargeC'], `Between ${tempInText(min)} and ${tempInText(max)}`);
  }
  if (m.turningPoint.tS <= 0) issue(ctx, ['turningPoint', 'tS'], 'After 0:00');
  if (m.turningPoint.c >= m.chargeC) {
    issue(ctx, ['turningPoint', 'c'], `Below charge, ${tempInText(m.chargeC)}`);
  }
  const devS = m.drop.tS - m.firstCrack.tS;
  const dev = PROFILE_LIMITS.devTimeS;
  if (devS > 0 && (devS < dev.min || devS > dev.max)) {
    issue(ctx, ['drop', 'tS'], 'Between 0:30 and 10:00 after first crack');
  } else if (m.drop.tS > MAX_DROP_S) {
    issue(ctx, ['drop', 'tS'], `At most ${mmss(MAX_DROP_S)}`);
  }
  if (m.drop.c > MILESTONE_MAX_DROP_C) {
    issue(ctx, ['drop', 'c'], `At most ${tempInText(MILESTONE_MAX_DROP_C)}`);
  }
  // The cap sits just above drop, and a cap under charge would drop the roast as it starts.
  const minDropC = m.chargeC - MILESTONE_CAP_MARGIN_C;
  const chargeOk = m.chargeC >= min && m.chargeC <= max;
  if (chargeOk && m.drop.c <= minDropC) issue(ctx, ['drop', 'c'], `Above ${tempInText(minDropC)}`);
}

/** Your points that sit at their own time between the turning point and drop. */
function placedExtras(m: Milestones, ctx: Ctx): Named[] {
  const taken = new Set([m.turningPoint, m.dryEnd, m.firstCrack, m.drop].map((p) => p.tS));
  const placed: Named[] = [];
  m.extras.forEach((point, index) => {
    const path = ['extras', index, 'tS'];
    if (point.tS <= m.turningPoint.tS || point.tS >= m.drop.tS) {
      issue(ctx, path, `Between ${mmss(m.turningPoint.tS)} and ${mmss(m.drop.tS)}`);
    } else if (taken.has(point.tS)) {
      issue(ctx, path, `Another point is at ${mmss(point.tS)}`);
    } else {
      taken.add(point.tS);
      placed.push({ ...point, path: ['extras', index] });
    }
  });
  return placed;
}

/** In time order, each point after the turning point is warmer than the one before. */
function warming(m: Milestones, extras: Named[], ctx: Ctx) {
  const named: Named[] = [
    { ...m.turningPoint, path: ['turningPoint'] },
    { ...m.dryEnd, path: ['dryEnd'] },
    { ...m.firstCrack, path: ['firstCrack'] },
    { ...m.drop, path: ['drop'] },
    ...extras,
  ].sort((a, b) => a.tS - b.tS);
  named.slice(1).forEach((point, index) => {
    const before = named[index];
    if (before && point.c <= before.c) {
      issue(ctx, [...point.path, 'c'], `Above ${tempInText(before.c)} at ${mmss(before.tS)}`);
    }
  });
}

/**
 * What the milestone builder makes a curve profile from (docs/spec/roast-control.md). Temperatures
 * in the messages are tokens for `sayInUnit`.
 */
export const MilestonesSchema = z
  .object({
    chargeC: z.number(),
    turningPoint: CurvePointSchema,
    dryEnd: CurvePointSchema,
    firstCrack: CurvePointSchema,
    drop: CurvePointSchema,
    /** Your own points, anywhere between the turning point and drop. */
    extras: z.array(CurvePointSchema),
  })
  .superRefine((m, ctx) => {
    limits(m, ctx);
    if (forwardInTime(m, ctx)) warming(m, placedExtras(m, ctx), ctx);
  });

export type Milestones = z.infer<typeof MilestonesSchema>;
