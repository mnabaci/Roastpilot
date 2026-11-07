import { describe, expect, it } from 'vitest';
import { roundEta, secondsTo } from './eta';

describe('secondsTo', () => {
  it('is the gap over the RoR', () => {
    expect(secondsTo(196, 190, 8)).toBe(45);
  });

  it('is unknown without a rise, a reading or a target, or once BT is there', () => {
    expect(secondsTo(196, 190, 0)).toBeUndefined();
    expect(secondsTo(196, 190, -2)).toBeUndefined();
    expect(secondsTo(196, 190, undefined)).toBeUndefined();
    expect(secondsTo(196, undefined, 8)).toBeUndefined();
    expect(secondsTo(undefined, 190, 8)).toBeUndefined();
    expect(secondsTo(196, 196, 8)).toBeUndefined();
  });
});

describe('roundEta', () => {
  it('rounds to 5 s, and never shows less than 5 s', () => {
    expect(roundEta(43)).toBe(45);
    expect(roundEta(47.4)).toBe(45);
    expect(roundEta(47.5)).toBe(50);
    expect(roundEta(1)).toBe(5);
  });
});
