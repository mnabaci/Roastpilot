import type { Bean } from '@roastpilot/shared';

/** A bean with some stock, for screens that list or pick beans. */
export const BEAN: Bean = {
  id: 1,
  name: 'Yirgacheffe',
  origin: 'Ethiopia',
  process: 'washed',
  variety: null,
  altitudeM: 1900,
  densityGL: 830,
  moisturePct: null,
  screen: null,
  decaf: false,
  supplier: null,
  lowStockG: 500,
  notes: null,
  profileId: null,
  greenG: 300,
  roastedG: 100,
  archived: false,
  avgLossPct: null,
  batchPlan: { kind: 'equal', batchesG: [375, 375] },
};
