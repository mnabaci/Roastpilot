import type { Bean, RoastSummary } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { setupForBean, stockWarning } from './roast-setup';

const BEAN = { id: 1, greenG: 500, batchPlan: null } as Bean;
const FAVOURITE = {
  id: 7,
  beanId: 1,
  isFavourite: true,
  rating: 5,
  startedAt: '2026-11-04',
  profileId: null,
} as RoastSummary;
const CONTEXT = { roaster: { batchIdealG: 385 }, roasts: [FAVOURITE], profileId: null };

describe('setupForBean', () => {
  it('takes the batch from the roaster and the ghost from its best favourite', () => {
    expect(setupForBean(BEAN, CONTEXT)).toEqual({ beanId: 1, batchG: 385, ghostRoastId: 7 });
  });

  it('prefers the batch plan', () => {
    const planned = { ...BEAN, batchPlan: { kind: 'equal', batchesG: [334, 333] } } as Bean;
    expect(setupForBean(planned, CONTEXT).batchG).toBe(334);
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
