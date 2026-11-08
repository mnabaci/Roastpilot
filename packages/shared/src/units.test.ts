import { describe, expect, it } from 'vitest';
import {
  diffFromUnit,
  diffInText,
  diffNumber,
  diffPlain,
  diffToUnit,
  formatDiff,
  formatPlainTemp,
  formatTemp,
  fromUnit,
  rateInText,
  rorSymbol,
  sayInUnit,
  tempInText,
  tempNumber,
  tempPlain,
  tempSymbol,
  toUnit,
} from './units';

describe('temperatures', () => {
  it('shows a temperature in °F as × 1.8 + 32', () => {
    expect(toUnit(200, 'f')).toBe(392);
    expect(toUnit(0, 'f')).toBe(32);
    expect(toUnit(200, 'c')).toBe(200);
  });

  it('reads a typed °F back to °C, kept to 0.1', () => {
    expect(fromUnit(400, 'f')).toBe(204.4);
    expect(fromUnit(392, 'f')).toBe(200);
    expect(fromUnit(204.44, 'c')).toBe(204.44);
  });

  it('shows a typed °F again as typed', () => {
    for (const typed of [100, 122, 392, 400, 401, 428, 455]) {
      expect(tempPlain(fromUnit(typed, 'f'), 'f')).toBe(String(typed));
    }
  });

  it('shows °F whole and °C with the decimals asked for', () => {
    expect(tempNumber(182.44, 'c', 1)).toBe('182.4');
    expect(tempNumber(182.44, 'f', 1)).toBe('360');
    expect(formatTemp(200, 'f')).toBe('392 °F');
    expect(formatTemp(205.5, 'c', 1)).toBe('205.5 °C');
  });

  it('says a profile’s or a setting’s temperature with its unit', () => {
    expect(formatPlainTemp(196.5, 'c')).toBe('196.5 °C');
    expect(formatPlainTemp(50, 'f')).toBe('122 °F');
  });

  it('keeps a field’s °C as stored', () => {
    expect(tempPlain(196.5, 'c')).toBe('196.5');
    expect(tempPlain(196.5, 'f')).toBe('386');
  });

  it('names the unit', () => {
    expect(tempSymbol('c')).toBe('°C');
    expect(tempSymbol('f')).toBe('°F');
    expect(rorSymbol('f')).toBe('°F/min');
  });
});

describe('differences', () => {
  it('scales a difference by 1.8 and never adds 32', () => {
    expect(diffToUnit(10, 'f')).toBe(18);
    expect(diffToUnit(0, 'f')).toBe(0);
    expect(diffToUnit(-10, 'f')).toBe(-18);
    expect(diffToUnit(2, 'c')).toBe(2);
  });

  it('shows a RoR with the same decimals in both units', () => {
    expect(diffNumber(8.1, 'f', 1)).toBe('14.6');
    expect(diffNumber(10, 'f', 1)).toBe('18.0');
    expect(diffNumber(-0.01, 'c', 1)).toBe('0.0');
  });

  it('says a difference with its unit, without + 32', () => {
    expect(formatDiff(3, 'c')).toBe('3 °C');
    expect(formatDiff(3, 'f')).toBe('5.4 °F');
  });

  it('shows a typed difference to 0.1 °F, without a trailing .0', () => {
    expect(diffPlain(2, 'f')).toBe('3.6');
    expect(diffPlain(10, 'f')).toBe('18');
    expect(diffPlain(2.5, 'c')).toBe('2.5');
  });

  it('reads a typed difference back without 32, to 0.01 °C, so it shows as typed', () => {
    expect(diffFromUnit(18, 'f')).toBe(10);
    expect(diffFromUnit(3.6, 'f')).toBe(2);
    for (const typed of ['3.5', '15', '-7.2', '81', '0.1']) {
      expect(diffPlain(diffFromUnit(Number(typed), 'f'), 'f')).toBe(typed);
    }
  });
});

describe('sayInUnit', () => {
  const text = `Between ${tempInText(100)} and ${tempInText(230)} · at most ${diffInText(10)}`;

  it('says a message the rules wrote in °C', () => {
    expect(sayInUnit(text, 'c')).toBe('Between 100 °C and 230 °C · at most 10 °C');
  });

  it('says it in °F: temperatures whole, differences without 32', () => {
    expect(sayInUnit(text, 'f')).toBe('Between 212 °F and 446 °F · at most 18 °F');
    expect(sayInUnit(`At least ${diffInText(-10)}`, 'f')).toBe('At least -18 °F');
    expect(sayInUnit(`BT cap ${tempInText(220)}`, 'f')).toBe('BT cap 428 °F');
  });

  it('says a rate as a bare number, keeping its decimals', () => {
    const rate = `RoR ${rateInText('6.5')} · step wants ${rateInText('8')}–${rateInText('12')}`;
    expect(sayInUnit(rate, 'c')).toBe('RoR 6.5 · step wants 8–12');
    expect(sayInUnit(rate, 'f')).toBe('RoR 11.7 · step wants 14.4–21.6');
    expect(sayInUnit(`RoR ${rateInText('10.0')}`, 'f')).toBe('RoR 18.0');
  });

  it('leaves text without temperatures alone', () => {
    expect(sayInUnit('At most 15:00 {not a token}', 'f')).toBe('At most 15:00 {not a token}');
  });
});
