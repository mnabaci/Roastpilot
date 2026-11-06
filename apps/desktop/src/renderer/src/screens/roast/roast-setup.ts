import { defaultGhost } from '@roastpilot/core';
import type { Bean, Roaster, RoastSetup, RoastSummary } from '@roastpilot/shared';

/** Choosing a bean: its next planned batch and its ghost, both of which you can change. */
export function setupForBean(
  bean: Bean | undefined,
  context: {
    roaster: Pick<Roaster, 'batchIdealG'>;
    roasts: readonly RoastSummary[];
    profileId: string | null;
  },
): RoastSetup {
  const { roaster, roasts, profileId } = context;
  const ghost = defaultGhost({ beanId: bean?.id ?? null, profileId, roasts });
  return {
    beanId: bean?.id ?? null,
    batchG: bean ? (bean.batchPlan?.batchesG[0] ?? roaster.batchIdealG) : null,
    ghostRoastId: ghost?.id ?? null,
  };
}

/** One line when the batch is more than the count says is left: it's allowed, as the count may be off. */
export function stockWarning(bean: Bean | undefined, batchG: number | null): string | undefined {
  if (!bean || batchG === null || batchG <= bean.greenG) return undefined;
  return `More than the ${String(Math.round(bean.greenG))} g of green left · stock stops at 0`;
}
