import { describe, expect, it } from 'vitest';
import { coachInputOf } from './coach.harness';
import { dropSoonRule } from './drop-soon-rule';
import { firstCrackSoonRule } from './first-crack-soon-rule';

describe('firstCrackSoonRule', () => {
  it('speaks within 60 s of the expected first crack, in steps of 5 s', () => {
    // 196 °C expected, BT 189 at 10 °C/min: 42 s.
    expect(firstCrackSoonRule.advise(coachInputOf({ btC: 189 }))).toEqual({
      kind: 'first-crack-soon',
      inS: 40,
    });
    // 60 s exactly.
    expect(firstCrackSoonRule.advise(coachInputOf({ btC: 186 }))).toMatchObject({ inS: 60 });
  });

  it('waits while first crack is more than 60 s away', () => {
    expect(firstCrackSoonRule.advise(coachInputOf({ btC: 185 }))).toBeUndefined();
  });

  it('says nothing without an expected first crack, a rise, or once BT is there', () => {
    expect(
      firstCrackSoonRule.advise(coachInputOf({ btC: 190, expectedFirstCrackC: undefined })),
    ).toBeUndefined();
    expect(firstCrackSoonRule.advise(coachInputOf({ btC: 190, ror: 0 }))).toBeUndefined();
    expect(firstCrackSoonRule.advise(coachInputOf({ btC: 190, ror: -1 }))).toBeUndefined();
    expect(firstCrackSoonRule.advise(coachInputOf({ btC: 190, ror: undefined }))).toBeUndefined();
    expect(firstCrackSoonRule.advise(coachInputOf({ btC: 197 }))).toBeUndefined();
  });

  it('says nothing after your first-crack tap', () => {
    const tapped = coachInputOf({ btC: 190, firstCrackAtMs: 190_000 });
    expect(firstCrackSoonRule.advise(tapped)).toBeUndefined();
    expect(firstCrackSoonRule.advise({ ...tapped, roastPhase: 'development' })).toBeUndefined();
  });
});

describe('dropSoonRule', () => {
  // First crack at 500 s; the profile develops 90 s and caps BT at 220 °C.
  const development = (s: number, btC: number, ror: number | undefined = 5) =>
    coachInputOf({
      roastPhase: 'development',
      firstCrackAtMs: 500_000,
      nowMs: (500 + s) * 1_000,
      btC,
      ror,
    });

  it('speaks 30 s before the development time, and counts down', () => {
    expect(dropSoonRule.advise(development(59, 200))).toBeUndefined();
    expect(dropSoonRule.advise(development(60, 200))).toEqual({
      kind: 'drop-soon',
      inS: 30,
      devTimeS: 90,
    });
    expect(dropSoonRule.advise(development(72, 201))).toMatchObject({ inS: 20 });
  });

  it('goes quiet once the development time has passed', () => {
    expect(dropSoonRule.advise(development(90, 202))).toBeUndefined();
  });

  it('warns of the BT cap instead when BT gets there first', () => {
    // 4 °C to go at 12 °C/min: 20 s, before the 30 s of development left.
    expect(dropSoonRule.advise(development(60, 216, 12))).toEqual({
      kind: 'cap-soon',
      inS: 20,
      capC: 220,
    });
    // 10 °C to go at 24 °C/min: 25 s, with 60 s of development left.
    expect(dropSoonRule.advise(development(30, 210, 24))).toMatchObject({ kind: 'cap-soon' });
  });

  it('warns of the development time when it comes before the cap, or BT is not rising', () => {
    expect(dropSoonRule.advise(development(70, 215, 12))).toMatchObject({ kind: 'drop-soon' });
    expect(dropSoonRule.advise(development(70, 219, 0))).toMatchObject({ kind: 'drop-soon' });
  });

  it('says nothing before your first-crack tap', () => {
    expect(dropSoonRule.advise(coachInputOf({ btC: 219, ror: 12 }))).toBeUndefined();
  });
});
