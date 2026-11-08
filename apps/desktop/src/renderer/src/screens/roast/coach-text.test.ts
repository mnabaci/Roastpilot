import { describe, expect, it } from 'vitest';
import { calibrationNote, coachChanges, headsUpLine } from './coach-text';

describe('coach text', () => {
  it('writes each output it changes, heater first', () => {
    const heater = { name: 'Heater', from: 65, to: 75, tone: 'heat' };
    const fan = { name: 'Fan', from: 50, to: 40, tone: 'air' };
    expect(coachChanges({ heater: { from: 65, to: 75 } })).toEqual([heater]);
    expect(coachChanges({ fan: { from: 50, to: 40 }, heater: { from: 65, to: 75 } })).toEqual([
      heater,
      fan,
    ]);
    expect(coachChanges({ fan: { from: 50, to: 40 } })).toEqual([fan]);
  });

  it('writes each heads-up in one line', () => {
    expect(headsUpLine({ kind: 'first-crack-soon', id: 1, inS: 45 }, 'c')).toBe(
      'First crack in ~45 s · listen',
    );
    expect(headsUpLine({ kind: 'drop-soon', id: 1, inS: 30, devTimeS: 105 }, 'c')).toBe(
      'Drop in ~30 s · 1:45 development',
    );
    expect(headsUpLine({ kind: 'cap-soon', id: 1, inS: 30, capC: 225 }, 'c')).toBe(
      'BT cap 225 °C in ~30 s',
    );
    expect(headsUpLine({ kind: 'cap-soon', id: 1, inS: 30, capC: 220 }, 'f')).toBe(
      'BT cap 428 °F in ~30 s',
    );
  });

  it('notes a profile that needs calibration', () => {
    expect(calibrationNote({ advice: null, needsCalibration: 'Light · Steps' })).toBe(
      'needs calibration',
    );
    expect(calibrationNote({ advice: null, needsCalibration: null })).toBeUndefined();
  });
});
