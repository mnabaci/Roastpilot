import type { z } from 'zod';
import type { CurvePoint, ProfilePhase } from './profile';

/** Sane limits for a profile, below the roaster's safety limits (docs/spec/safety.md). */
export const PROFILE_LIMITS = {
  chargeC: { min: 100, max: 230 },
  capC: { max: 235 },
  devTimeS: { min: 30, max: 600 },
  durationS: { max: 900 },
  backupS: { max: 1140 },
} as const;

/** What the rules read: a profile before its rules have passed. */
interface ProfileShape {
  chargeC: number;
  dryEndC: number;
  devTimeS: number;
  capC: number;
  curve: readonly CurvePoint[];
  phases: readonly ProfilePhase[];
}

type Issue = (path: (string | number)[], message: string) => void;

function checkLimits({ chargeC, capC, devTimeS, dryEndC }: ProfileShape, issue: Issue): void {
  const { chargeC: charge, capC: cap, devTimeS: dev } = PROFILE_LIMITS;
  if (chargeC < charge.min || chargeC > charge.max) {
    issue(['chargeC'], `Between ${String(charge.min)} and ${String(charge.max)} °C`);
  }
  if (capC > cap.max) issue(['capC'], `At most ${String(cap.max)} °C`);
  if (devTimeS < dev.min || devTimeS > dev.max) issue(['devTimeS'], 'Between 0:30 and 10:00');
  if (dryEndC >= capC) issue(['dryEndC'], 'Must be below the BT cap');
  if (capC <= chargeC) issue(['capC'], `Above charge, ${String(chargeC)} °C`);
}

/** Each step within its limits; temperature triggers below the cap and each above the one before. */
function checkSteps({ capC, phases }: ProfileShape, issue: Issue): void {
  let lastTriggerC = Number.NEGATIVE_INFINITY;
  let lastBackupS = 0;
  phases.forEach(({ heat, next }, index) => {
    if (heat.mode === 'target' && heat.durationS > PROFILE_LIMITS.durationS.max) {
      issue(['phases', index, 'heat', 'durationS'], 'At most 15:00');
    }
    if (next.on !== 'bt') return;
    const path = ['phases', index, 'next'];
    if (next.c >= capC) issue([...path, 'c'], 'Must be below the BT cap');
    if (next.c <= lastTriggerC) issue([...path, 'c'], 'Must be above the step before');
    if (next.backupS <= lastBackupS) issue([...path, 'backupS'], 'Must be after the step before');
    if (next.backupS > PROFILE_LIMITS.backupS.max) issue([...path, 'backupS'], 'At most 19:00');
    lastTriggerC = next.c;
    lastBackupS = next.backupS;
  });
}

/** A target step ends where the next phase starts; only the last phase ends with the end rule. */
function checkPhaseChain({ phases }: ProfileShape, issue: Issue): void {
  const lastIndex = phases.length - 1;
  phases.forEach(({ heat, next }, index) => {
    if (heat.mode === 'target' && next.on === 'bt' && heat.endC !== next.c) {
      issue(
        ['phases', index, 'heat', 'endC'],
        'a target step must end at the temperature that starts the next phase',
      );
    }
    if ((next.on === 'end') !== (index === lastIndex)) {
      issue(
        ['phases', index, 'next'],
        'only the last phase, and always the last phase, ends with the end rule',
      );
    }
  });
}

/** After charge, the curve goes forward in time and never above the cap. */
function checkCurve({ capC, curve }: ProfileShape, issue: Issue): void {
  curve.slice(1).forEach((point, i) => {
    const index = i + 1;
    if (point.c > capC) issue(['curve', index, 'c'], 'Must not be above the BT cap');
    const previous = curve[i];
    if (previous && point.tS <= previous.tS) {
      issue(['curve', index, 'tS'], 'curve points must go forward in time');
    }
  });
}

/** The profile rules zod can't say field by field (docs/spec/roast-control.md, Profile format). */
export function checkProfile(profile: ProfileShape, ctx: z.RefinementCtx): void {
  const issue: Issue = (path, message) => {
    ctx.addIssue({ code: 'custom', path, message });
  };
  checkLimits(profile, issue);
  checkSteps(profile, issue);
  checkPhaseChain(profile, issue);
  checkCurve(profile, issue);
}

/** What a roaster allows, from its record (docs/spec/roasters.md, Limits). */
export interface RoasterLimits {
  maxTempC: number;
  maxTimeS: number;
}

/** What a profile from elsewhere asks of this roaster beyond its limits; undefined when it fits. */
export function overRoasterLimits(
  { capC, curve, phases }: Pick<ProfileShape, 'capC' | 'curve' | 'phases'>,
  { maxTempC, maxTimeS }: RoasterLimits,
): string | undefined {
  if (capC > maxTempC) {
    return `BT cap ${String(capC)} °C is above this roaster's ${String(maxTempC)} °C`;
  }
  const lastS = Math.max(
    ...curve.map((point) => point.tS),
    ...phases.map(({ next }) => (next.on === 'bt' ? next.backupS : 0)),
  );
  if (lastS > maxTimeS) {
    return `Runs past this roaster's ${String(maxTimeS / 60)} min limit`;
  }
  return undefined;
}
