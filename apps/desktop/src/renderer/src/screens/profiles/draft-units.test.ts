import { describe, expect, it } from 'vitest';
import { STEPS } from '../../test/profiles';
import { draftInUnit } from './draft-units';
import { toDraft } from './profile-draft';

describe('draftInUnit', () => {
  it('turns a kept °C draft into °F, leaving half-typed text alone', () => {
    const draft = { ...toDraft(STEPS, 'c'), chargeC: '200', capC: '' };
    const inF = draftInUnit(draft, 'f');
    expect(inF).toMatchObject({ unit: 'f', chargeC: '392', capC: '' });
    // The first step's RoR range: a rate, × 1.8 only.
    expect(inF.steps[0]).toMatchObject({ endC: '302', rorMin: '25.2', rorMax: '32.4' });
  });

  it('is the same draft when the unit is unchanged', () => {
    const draft = toDraft(STEPS, 'f');
    expect(draftInUnit(draft, 'f')).toBe(draft);
  });
});
