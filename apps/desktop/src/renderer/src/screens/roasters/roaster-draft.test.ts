import { describe, expect, it } from 'vitest';
import { SKYWALKER } from '../../test/roasters';
import { fromRoasterDraft, toRoasterDraft, type RoasterDraft } from './roaster-draft';

const draft = (change: Partial<RoasterDraft> = {}) => ({ ...toRoasterDraft(SKYWALKER), ...change });
const errorsOf = (change: Partial<RoasterDraft>) => {
  const result = fromRoasterDraft(draft(change), SKYWALKER);
  return result.ok ? {} : result.error;
};

describe('roaster draft', () => {
  it('gives the record back unchanged', () => {
    expect(fromRoasterDraft(draft(), SKYWALKER)).toEqual({ ok: true, value: SKYWALKER });
  });

  it('keeps whether the bean cooler helps cool the drum', () => {
    expect(fromRoasterDraft(draft({ coolerHelpsDrum: false }), SKYWALKER)).toMatchObject({
      ok: true,
      value: { coolerHelpsDrum: false },
    });
  });

  it('reads times, minutes and gains', () => {
    const result = fromRoasterDraft(
      draft({ hold: '1:30', maxTimeMin: '15', targetKp: '2' }),
      SKYWALKER,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { maxTimeS: 900, tuning: { holdS: 90, target: { kp: 2 } } },
    });
  });

  it('names a cell with a half-typed value', () => {
    expect(errorsOf({ batchMinG: '2x' })).toEqual({ batchMinG: 'Enter a number' });
    expect(errorsOf({ hold: '90' })).toEqual({ hold: 'Enter a time like 2:30' });
  });

  it('holds the limits to what the model allows', () => {
    expect(errorsOf({ maxTempC: '250' })).toEqual({ maxTempC: 'At most 240 °C on this model' });
    expect(errorsOf({ maxTimeMin: '25' })).toEqual({ maxTimeMin: 'At most 20 min on this model' });
  });

  it('keeps batch sizes in order, and the offset small', () => {
    expect(errorsOf({ batchMinG: '380' })).toHaveProperty('batchMinG');
    expect(errorsOf({ batchMaxG: '300' })).toHaveProperty('batchMaxG');
    expect(errorsOf({ tempOffsetC: '50' })).toHaveProperty('tempOffsetC');
  });

  it('needs a name, and points a gain problem at its cell', () => {
    expect(errorsOf({ name: ' ' })).toHaveProperty('name');
    expect(errorsOf({ targetKp: '-1' })).toHaveProperty('targetKp');
  });
});
