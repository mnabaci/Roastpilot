import { describe, expect, it } from 'vitest';
import { calibrationNote, coachChanges, headsUpLine } from './coach-text';

describe('coach text', () => {
  it('writes each output it changes, heater first', () => {
    expect(coachChanges({ heater: { from: 65, to: 75 } })).toEqual(['Heater 65% → 75%']);
    expect(coachChanges({ fan: { from: 50, to: 40 }, heater: { from: 65, to: 75 } })).toEqual([
      'Heater 65% → 75%',
      'Fan 50% → 40%',
    ]);
    expect(coachChanges({ fan: { from: 50, to: 40 } })).toEqual(['Fan 50% → 40%']);
  });

  it('writes each heads-up in one line', () => {
    expect(headsUpLine({ kind: 'first-crack-soon', id: 1, inS: 45 })).toBe(
      'First crack in ~45 s · listen',
    );
    expect(headsUpLine({ kind: 'drop-soon', id: 1, inS: 30, devTimeS: 105 })).toBe(
      'Drop in ~30 s · 1:45 development',
    );
    expect(headsUpLine({ kind: 'cap-soon', id: 1, inS: 30, capC: 225 })).toBe(
      'BT cap 225 °C in ~30 s',
    );
  });

  it('notes a profile that needs calibration', () => {
    expect(calibrationNote({ advice: null, needsCalibration: 'Light · Steps' })).toBe(
      'needs calibration',
    );
    expect(calibrationNote({ advice: null, needsCalibration: null })).toBeUndefined();
  });
});
