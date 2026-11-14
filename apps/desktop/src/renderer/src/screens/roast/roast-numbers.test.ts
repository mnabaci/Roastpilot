import type { Reading, RoastState } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { READY_ROAST } from '@roastpilot/shared';
import { roastNumbers } from './roast-numbers';

const readings = (untilS: number): Reading[] =>
  Array.from({ length: untilS + 1 }, (_, s) => ({ atMs: s * 1000, values: { bt: 100 + s / 6 } }));
const roast = (patch: Partial<RoastState>): RoastState => ({ ...READY_ROAST, ...patch });

describe('roastNumbers', () => {
  it('shows nothing before any reading', () => {
    expect(roastNumbers(READY_ROAST, [])).toEqual({
      bt: undefined,
      ror: undefined,
      elapsedS: undefined,
      preheatS: undefined,
      developmentS: undefined,
      developmentPct: undefined,
      coolingLeftS: undefined,
    });
  });

  it('BT from the readings; no RoR or time before charge, as on the chart', () => {
    const n = roastNumbers(roast({ phase: 'preheat' }), readings(60));
    expect(n.bt).toBeCloseTo(110);
    expect(n.ror).toBeUndefined();
    expect(n.elapsedS).toBeUndefined();
  });

  it('ET from the latest reading, where the roaster has one', () => {
    const latest = { atMs: 1000, values: { bt: 150, et: 171.5 } };
    expect(roastNumbers(roast({ phase: 'preheat' }), [latest]).et).toBe(171.5);
    expect(roastNumbers(roast({ phase: 'preheat' }), readings(5)).et).toBeUndefined();
  });

  it('counts the preheat until charge', () => {
    const n = roastNumbers(roast({ phase: 'preheat', preheatAtMs: 10_000 }), readings(60));
    expect(n).toMatchObject({ preheatS: 50, elapsedS: undefined });
    const charged = roastNumbers(
      roast({ phase: 'roasting', preheatAtMs: 10_000, chargedAtMs: 40_000 }),
      readings(60),
    );
    expect(charged).toMatchObject({ preheatS: undefined, elapsedS: 20 });
  });

  it('time since charge and development with its share of the roast', () => {
    const n = roastNumbers(
      roast({ phase: 'development', chargedAtMs: 0, firstCrackAtMs: 400_000 }),
      readings(500),
    );
    expect(n).toMatchObject({ elapsedS: 500, developmentS: 100, developmentPct: 20 });
  });

  it('freezes at drop and counts the cooling down', () => {
    const n = roastNumbers(
      roast({
        phase: 'cooling',
        chargedAtMs: 0,
        firstCrackAtMs: 400_000,
        droppedAtMs: 480_000,
        coolingEndsAtMs: 720_000,
      }),
      readings(500),
    );
    expect(n).toMatchObject({ elapsedS: 480, developmentS: 80, coolingLeftS: 220 });
  });

  it('never shows a negative time', () => {
    const n = roastNumbers(
      roast({ phase: 'cooling', chargedAtMs: 0, coolingEndsAtMs: 1_000 }),
      readings(5),
    );
    expect(n.coolingLeftS).toBe(0);
  });

  it('never gives NaN for a preheat time it cannot know', () => {
    const n = roastNumbers(roast({ phase: 'preheat', preheatAtMs: undefined }), readings(5));
    expect(n.preheatS).toBeUndefined();
  });

  it('RoR never reaches back before charge: a dash for the first 30 s after it', () => {
    expect(roastNumbers(roast({ phase: 'roasting', chargedAtMs: 50_000 }), readings(60)).ror).toBe(
      undefined,
    );
    expect(
      roastNumbers(roast({ phase: 'roasting', chargedAtMs: 20_000 }), readings(60)).ror,
    ).toBeCloseTo(10);
  });
});
