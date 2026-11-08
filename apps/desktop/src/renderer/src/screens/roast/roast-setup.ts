import { defaultGhost } from '@roastpilot/core';
import type {
  AutoProfile,
  Bean,
  Roaster,
  RoastSetup,
  RoastSummary,
  Settings,
} from '@roastpilot/shared';

/**
 * Choosing a bean: its next planned batch (else the batch the followed profile was tuned for, else
 * the roaster's ideal) and its ghost, both of which you can change (docs/spec/ui.md, Before preheat).
 */
export function setupForBean(
  bean: Bean | undefined,
  context: {
    roaster: Pick<Roaster, 'batchIdealG'>;
    roasts: readonly RoastSummary[];
    profileId: string | null;
    /** The batch the profile the roast follows was tuned for; none in Manual without the coach. */
    tunedForG: number | undefined;
  },
): RoastSetup {
  const { roaster, roasts, profileId, tunedForG } = context;
  const ghost = defaultGhost({ beanId: bean?.id ?? null, profileId, roasts });
  return {
    beanId: bean?.id ?? null,
    batchG: bean ? (bean.batchPlan?.batchesG[0] ?? tunedForG ?? roaster.batchIdealG) : null,
    ghostRoastId: ghost?.id ?? null,
  };
}

/**
 * The batch the profile the next roast follows was tuned for: Auto's, or the coach's in Manual;
 * undefined in Manual without the coach, as nothing is followed then.
 */
export function tunedForG(
  settings: Pick<Settings, 'roastMode' | 'coachInManual'>,
  profile: Pick<AutoProfile, 'batchG'> | undefined,
): number | undefined {
  return settings.roastMode === 'auto' || settings.coachInManual ? profile?.batchG : undefined;
}

/** One line when the batch is more than the count says is left: it's allowed, as the count may be off. */
export function stockWarning(bean: Bean | undefined, batchG: number | null): string | undefined {
  if (!bean || batchG === null || batchG <= bean.greenG) return undefined;
  return `More than the ${String(Math.round(bean.greenG))} g of green left · stock stops at 0`;
}

/** Up to this far from the profile's batch, a roast runs close enough to its plan. */
export const BATCH_TOLERANCE = 0.1;

const grams = (g: number) => `${String(Math.round(g))} g`;

/**
 * One line when the batch is more than 10 % off the batch the profile was tuned for: the same heat
 * on fewer beans runs hotter and faster, on more beans cooler and slower. Not an error; Start stays.
 */
export function batchWarning(
  batchG: number | null,
  tunedForG: number | undefined,
): string | undefined {
  if (batchG === null || tunedForG === undefined || tunedForG <= 0) return undefined;
  if (Math.abs(batchG - tunedForG) <= tunedForG * BATCH_TOLERANCE) return undefined;
  const runs = batchG < tunedForG ? 'hotter and faster' : 'cooler and slower';
  return `Profile tuned for ${grams(tunedForG)} · a ${grams(batchG)} batch runs ${runs}`;
}
