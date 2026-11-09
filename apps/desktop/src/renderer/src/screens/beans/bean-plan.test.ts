import type { ProfileEntry } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { beanPlan } from './bean-plan';

const ROASTER = { batchMinG: 250, batchIdealG: 375, batchMaxG: 400 };
const OWN = { profile: { id: 'own', batchG: 356 } } as ProfileEntry;

describe('beanPlan', () => {
  it("plans its green stock around its own profile's batch", () => {
    const plan = beanPlan(
      { greenG: 1784, profileId: 'own' },
      { roaster: ROASTER, profiles: [OWN], autoProfileG: 375 },
    );
    expect(plan).toEqual({
      targetG: 356,
      source: 'own-profile',
      batchesG: [360, 356, 356, 356, 356],
    });
  });

  it("without its own profile on this roaster, uses Auto's, then the roaster's ideal", () => {
    // Its own profile belongs to another roaster, so it isn't among this one's profiles.
    const bean = { greenG: 1000, profileId: 'other-roaster' };
    expect(beanPlan(bean, { roaster: ROASTER, profiles: [OWN], autoProfileG: 340 })).toMatchObject({
      targetG: 340,
      source: 'auto-profile',
    });
    expect(
      beanPlan(bean, { roaster: ROASTER, profiles: [], autoProfileG: undefined }),
    ).toMatchObject({ targetG: 375, source: 'roaster', batchesG: [334, 333, 333] });
  });

  it("keeps the target inside this roaster's range", () => {
    const big = { profile: { id: 'own', batchG: 500 } } as ProfileEntry;
    expect(
      beanPlan(
        { greenG: 800, profileId: 'own' },
        { roaster: ROASTER, profiles: [big], autoProfileG: undefined },
      ).targetG,
    ).toBe(400);
  });

  it('has no batches with no stock', () => {
    expect(
      beanPlan(
        { greenG: 0, profileId: null },
        { roaster: ROASTER, profiles: [], autoProfileG: undefined },
      ).batchesG,
    ).toEqual([]);
  });
});
