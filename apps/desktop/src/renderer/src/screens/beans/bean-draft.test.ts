import { describe, expect, it } from 'vitest';
import { fromBeanDraft, toBeanDraft } from './bean-draft';

const draft = { ...toBeanDraft(undefined), name: 'Yirgacheffe', origin: 'Ethiopia' };

describe('bean draft', () => {
  it('needs only a name and an origin; empty optional cells are no value', () => {
    expect(fromBeanDraft(draft)).toEqual({
      ok: true,
      value: {
        name: 'Yirgacheffe',
        origin: 'Ethiopia',
        process: 'washed',
        decaf: false,
        variety: null,
        supplier: null,
        notes: null,
        altitudeM: null,
        densityGL: null,
        moisturePct: null,
        screen: null,
        lowStockG: 500,
      },
    });
  });

  it('says what is missing, per cell', () => {
    expect(fromBeanDraft(toBeanDraft(undefined))).toEqual({
      ok: false,
      error: { name: 'Enter a name', origin: 'Enter an origin' },
    });
  });

  it('refuses a number that is not one, or out of range', () => {
    const result = fromBeanDraft({ ...draft, densityGL: 'heavy', moisturePct: '140' });
    expect(result).toEqual({
      ok: false,
      error: { densityGL: 'Enter a number', moisturePct: 'At most 100' },
    });
  });

  it('round-trips a saved bean', () => {
    const filled = fromBeanDraft({
      ...draft,
      densityGL: '780',
      decaf: true,
      variety: ' Heirloom ',
    });
    if (!filled.ok) throw new Error('should be valid');
    const bean = {
      ...filled.value,
      id: 1,
      profileId: null,
      greenG: 0,
      roastedG: 0,
      archived: false,
      avgLossPct: null,
      batchPlan: null,
    };
    expect(fromBeanDraft(toBeanDraft(bean))).toEqual(filled);
    expect(filled.value).toMatchObject({ densityGL: 780, decaf: true, variety: 'Heirloom' });
  });
});
