import { describe, expect, it } from 'vitest';
import { SKYWALKER } from '../../test/roasters';
import { fromRoasterDraft, toRoasterDraft, type RoasterDraft } from './roaster-draft';

const draft = (change: Partial<RoasterDraft> = {}) => ({
  ...toRoasterDraft(SKYWALKER, 'c'),
  ...change,
});
const errorsOf = (change: Partial<RoasterDraft>) => {
  const result = fromRoasterDraft(draft(change), SKYWALKER, 'c');
  return result.ok ? {} : result.error;
};

describe('roaster draft', () => {
  it('gives the record back unchanged', () => {
    expect(fromRoasterDraft(draft(), SKYWALKER, 'c')).toEqual({ ok: true, value: SKYWALKER });
  });

  it('keeps whether the bean cooler helps cool the drum', () => {
    expect(fromRoasterDraft(draft({ coolerHelpsDrum: false }), SKYWALKER, 'c')).toMatchObject({
      ok: true,
      value: { coolerHelpsDrum: false },
    });
  });

  it('reads the drum speed, held to 5–100 % in steps of 5', () => {
    expect(fromRoasterDraft(draft({ drumSpeedPct: '45' }), SKYWALKER, 'c')).toMatchObject({
      value: { drumSpeedPct: 45 },
    });
    expect(errorsOf({ drumSpeedPct: '42' })).toEqual({ drumSpeedPct: 'In steps of 5 %' });
    expect(errorsOf({ drumSpeedPct: '' })).toEqual({ drumSpeedPct: 'Enter a number' });
  });

  it('reads times, minutes and gains', () => {
    const result = fromRoasterDraft(
      draft({ hold: '1:30', maxTimeMin: '15', targetKp: '2' }),
      SKYWALKER,
      'c',
    );
    expect(result).toMatchObject({
      ok: true,
      value: { maxTimeS: 900, tuning: { holdS: 90, target: { kp: 2 } } },
    });
  });

  it('reads how curves are followed', () => {
    const result = fromRoasterDraft(
      draft({ curveKp: '2', curveLookAheadS: '45', curvePullPerC: '0.5', curveSlewPct: '3' }),
      SKYWALKER,
      'c',
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        tuning: {
          curveFollow: { gains: { kp: 2 }, lookAheadS: 45, pullPerC: 0.5, slewPctPer10s: 3 },
        },
      },
    });
    expect(errorsOf({ curveSlewPct: '0' })).toHaveProperty('curveSlewPct');
    expect(errorsOf({ curveLimitPct: '' })).toEqual({ curveLimitPct: 'Enter a number' });
  });

  it('names a cell with a half-typed value', () => {
    expect(errorsOf({ batchMinG: '2x' })).toEqual({ batchMinG: 'Enter a number' });
    expect(errorsOf({ hold: '90' })).toEqual({ hold: 'Enter a time like 2:30' });
    expect(errorsOf({ nextHold: '2' })).toEqual({ nextHold: 'Enter a time like 2:30' });
  });

  it('keeps both preheat holds within 1:30–3:00, the edges included', () => {
    expect(errorsOf({ hold: '1:29' })).toEqual({ hold: 'Between 1:30 and 3:00' });
    expect(errorsOf({ nextHold: '3:01' })).toEqual({ nextHold: 'Between 1:30 and 3:00' });
    expect(errorsOf({ hold: '1:30', nextHold: '3:00' })).toEqual({});
  });

  it("reads the next batch's hold into the record", () => {
    const made = fromRoasterDraft(draft({ nextHold: '1:45' }), SKYWALKER, 'c');
    expect(made).toMatchObject({ ok: true, value: { tuning: { nextHoldS: 105 } } });
  });

  it('holds the limits to what the model allows', () => {
    expect(errorsOf({ maxTempC: '250' })).toEqual({ maxTempC: 'At most 240 °C on this model' });
    expect(errorsOf({ maxTimeMin: '25' })).toEqual({ maxTimeMin: 'At most 20 min on this model' });
  });

  describe('in °F', () => {
    const inF = (change: Partial<RoasterDraft> = {}) => ({
      ...toRoasterDraft({ ...SKYWALKER, tempOffsetC: 2 }, 'f'),
      ...change,
    });
    const read = (change: Partial<RoasterDraft> = {}) =>
      fromRoasterDraft(inF(change), { ...SKYWALKER, tempOffsetC: 2 }, 'f');

    it('shows the max temp + 32 and the offset as a difference, never + 32', () => {
      expect(inF()).toMatchObject({ maxTempC: '464', tempOffsetC: '3.6' });
      // The PID gains stay per °C.
      expect(inF().targetKp).toBe(String(SKYWALKER.tuning.target.kp));
    });

    it('reads them back to °C, keeping untouched values exact', () => {
      expect(read()).toEqual({ ok: true, value: { ...SKYWALKER, tempOffsetC: 2 } });
      expect(read({ maxTempC: '428', tempOffsetC: '-5.4' })).toMatchObject({
        value: { maxTempC: 220, tempOffsetC: -3 },
      });
    });

    it('says the limits in °F', () => {
      const over = read({ maxTempC: '482' });
      expect(over.ok ? {} : over.error).toEqual({ maxTempC: 'At most 464 °F on this model' });
      const offset = read({ tempOffsetC: '40' });
      expect(offset.ok ? {} : offset.error).toEqual({ tempOffsetC: 'At most 36 °F' });
    });
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
