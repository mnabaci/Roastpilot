import type { Reading, RoastState } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { READY_ROAST } from '../../stores/roast-store';
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

  it('BT and RoR from the readings; no time before charge', () => {
    const n = roastNumbers(roast({ phase: 'preheat' }), readings(60));
    expect(n.bt).toBeCloseTo(110);
    expect(n.ror).toBeCloseTo(10);
    expect(n.elapsedS).toBeUndefined();
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
});
