import { clampBatch, splitStock } from '@roastpilot/core';
import type { Bean, ProfileEntry, Roaster } from '@roastpilot/shared';

/** Where a bean's planned batch weight comes from. */
export type BatchSource = 'own-profile' | 'auto-profile' | 'roaster';

export interface BeanPlan {
  /** The batch it plans around, inside the roaster's min–max. */
  targetG: number;
  source: BatchSource;
  /** Its green stock left as equal batches; the first is the next roast's. Empty with no stock. */
  batchesG: number[];
}

export interface PlanContext {
  /** The active roaster: a bean belongs to no roaster, so it plans for the one in use. */
  roaster: Pick<Roaster, 'batchMinG' | 'batchIdealG' | 'batchMaxG'>;
  /** The active roaster's profiles; a bean's own profile on another roaster isn't among them. */
  profiles: readonly ProfileEntry[];
  /** The batch the profile Auto uses was tuned for. */
  autoProfileG: number | undefined;
}

/**
 * A bean's batch plan, worked out live from its green stock (docs/spec/batch-and-stock.md): equal
 * batches around its own profile's batch, else the batch of the profile Auto uses, else the
 * roaster's ideal. Nothing is stored, so a roast, new stock or another roaster re-plans it.
 */
export function beanPlan(
  bean: Pick<Bean, 'greenG' | 'profileId'>,
  { roaster, profiles, autoProfileG }: PlanContext,
): BeanPlan {
  const ownG = profiles.find((entry) => entry.profile.id === bean.profileId)?.profile.batchG;
  const [wantedG, source]: [number, BatchSource] =
    ownG !== undefined
      ? [ownG, 'own-profile']
      : autoProfileG !== undefined
        ? [autoProfileG, 'auto-profile']
        : [roaster.batchIdealG, 'roaster'];
  const sizes = { minG: roaster.batchMinG, maxG: roaster.batchMaxG };
  const targetG = clampBatch(wantedG, sizes);
  return { targetG, source, batchesG: splitStock(bean.greenG, targetG, sizes) };
}
