import { describe, expect, it } from 'vitest';
import { projection } from './projection';

describe('projection', () => {
  it('runs 2:00 ahead at the current RoR', () => {
    expect(projection({ nowS: 420, btC: 175, rorCPerMin: 9, edgeS: 736 })).toEqual([
      { tS: 420, c: 175 },
      { tS: 540, c: 193 },
    ]);
  });

  it('stops at the edge when that is nearer', () => {
    expect(projection({ nowS: 700, btC: 195, rorCPerMin: 6, edgeS: 760 })).toEqual([
      { tS: 700, c: 195 },
      { tS: 760, c: 201 },
    ]);
  });

  it('is none while RoR is unknown, flat or falling, or there is no temperature', () => {
    expect(projection({ nowS: 30, btC: 120, rorCPerMin: undefined, edgeS: 736 })).toEqual([]);
    expect(projection({ nowS: 30, btC: 120, rorCPerMin: 0, edgeS: 736 })).toEqual([]);
    expect(projection({ nowS: 30, btC: 120, rorCPerMin: -40, edgeS: 736 })).toEqual([]);
    expect(projection({ nowS: 30, btC: undefined, rorCPerMin: 10, edgeS: 736 })).toEqual([]);
  });

  it('is none at or past the edge', () => {
    expect(projection({ nowS: 760, btC: 199, rorCPerMin: 5, edgeS: 760 })).toEqual([]);
  });
});
