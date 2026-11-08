import type { Bean, RoastSummary } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { batchWarning, setupForBean, stockWarning, tunedForG } from './roast-setup';

const BEAN = { id: 1, greenG: 500, batchPlan: null } as Bean;
const FAVOURITE = {
  id: 7,
  beanId: 1,
  isFavourite: true,
  rating: 5,
  startedAt: '2026-11-04',
  profileId: null,
} as RoastSummary;
const CONTEXT = {
  roaster: { batchIdealG: 385 },
  roasts: [FAVOURITE],
  profileId: null,
  tunedForG: undefined,
};

describe('setupForBean', () => {
  it('without a plan, takes the batch the followed profile was tuned for', () => {
    expect(setupForBean(BEAN, { ...CONTEXT, tunedForG: 350 }).batchG).toBe(350);
  });

  it("with no plan and no profile, takes the roaster's ideal and the ghost from its best favourite", () => {
    expect(setupForBean(BEAN, CONTEXT)).toEqual({ beanId: 1, batchG: 385, ghostRoastId: 7 });
  });

  it('prefers the batch plan', () => {
    const planned = { ...BEAN, batchPlan: { kind: 'equal', batchesG: [334, 333] } } as Bean;
    expect(setupForBean(planned, { ...CONTEXT, tunedForG: 350 }).batchG).toBe(334);
  });

  it('No bean clears the batch', () => {
    expect(setupForBean(undefined, CONTEXT)).toEqual({
      beanId: null,
      batchG: null,
      ghostRoastId: null,
    });
  });
});

describe('stockWarning', () => {
  it('warns only when the batch is more than is left', () => {
    expect(stockWarning(BEAN, 600)).toMatch(/500 g of green left/);
    expect(stockWarning(BEAN, 500)).toBeUndefined();
    expect(stockWarning(BEAN, null)).toBeUndefined();
    expect(stockWarning(undefined, 600)).toBeUndefined();
  });
});

describe('batchWarning', () => {
  it('says a smaller batch runs hotter and faster, a bigger one cooler and slower', () => {
    expect(batchWarning(300, 385)).toBe(
      'Profile tuned for 385 g · a 300 g batch runs hotter and faster',
    );
    expect(batchWarning(450, 385)).toBe(
      'Profile tuned for 385 g · a 450 g batch runs cooler and slower',
    );
  });

  it('stays quiet up to exactly 10 % either way, and speaks just past it', () => {
    expect(batchWarning(400, 400)).toBeUndefined();
    expect(batchWarning(360, 400)).toBeUndefined();
    expect(batchWarning(440, 400)).toBeUndefined();
    expect(batchWarning(359, 400)).toMatch(/hotter and faster$/);
    expect(batchWarning(441, 400)).toMatch(/cooler and slower$/);
  });

  it('says nothing without a batch or a profile to compare with', () => {
    expect(batchWarning(null, 385)).toBeUndefined();
    expect(batchWarning(300, undefined)).toBeUndefined();
  });
});

describe('tunedForG', () => {
  const profile = { batchG: 385 };

  it("is the followed profile's batch in Auto, and in Manual with the coach", () => {
    expect(tunedForG({ roastMode: 'auto', coachInManual: false }, profile)).toBe(385);
    expect(tunedForG({ roastMode: 'manual', coachInManual: true }, profile)).toBe(385);
  });

  it('is undefined in Manual without the coach, or without a profile', () => {
    expect(tunedForG({ roastMode: 'manual', coachInManual: false }, profile)).toBeUndefined();
    expect(tunedForG({ roastMode: 'auto', coachInManual: true }, undefined)).toBeUndefined();
  });
});
