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

  it('turns a kept °F draft back into °C from the exact values, untouched cells unchanged', () => {
    const profile = { ...STEPS, dryEndC: 152 };
    // 152 °C shows as 306 °F; read from the text alone it would come back as 152.2.
    const inF = { ...toDraft(profile, 'f'), capC: '400' };
    const inC = draftInUnit(inF, 'c');
    expect(inC).toMatchObject({ unit: 'c', dryEndC: '152', capC: '204.4' });
    expect(inC.steps).toEqual(toDraft(profile, 'c').steps);
  });

  it('goes °C → °F → °C without a drift', () => {
    const draft = toDraft({ ...STEPS, dryEndC: 152 }, 'c');
    expect(draftInUnit(draftInUnit(draft, 'f'), 'c')).toEqual(draft);
  });
});
