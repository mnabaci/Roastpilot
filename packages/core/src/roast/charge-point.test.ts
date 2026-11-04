import type { Reading } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { CHARGE_LOOKBACK_MS, findChargePoint } from './charge-point';

/** One reading a second, ending at `endMs`. */
function series(bts: readonly number[], endMs: number): Reading[] {
  return bts.map((bt, i) => ({ atMs: endMs - (bts.length - 1 - i) * 1000, values: { bt } }));
}

const preheat = (n: number, from = 180) => Array.from({ length: n }, (_, i) => from + i * 0.3);

describe('findChargePoint', () => {
  it('finds the reading just before the charge drop, seconds before Start was pressed', () => {
    // Batch 2 of 2026-11-04: Start pressed about 7 s after the beans went in.
    const readings = series([...preheat(20), 186.4, 185.0, 181.5, 177.5, 171.6, 165.0], 60_000);
    const found = findChargePoint(readings, 60_000);
    expect(found?.values.bt).toBe(186.4);
    expect(found?.atMs).toBe(55_000);
  });

  it('takes the earliest drop in the minute, not a later wobble', () => {
    const readings = series(
      [...preheat(10), 183, 175, 165, 150, 140, 135, 134, 133, 128, 120],
      60_000,
    );
    expect(findChargePoint(readings, 60_000)?.values.bt).toBe(183);
  });

  it('finds a slower drop over every other reading', () => {
    // Falls 0.6 °C a second: too little per reading, enough over two.
    const readings = series(
      [...preheat(12), 185, 184.4, 183.8, 183.2, 182.6, 182.0, 181.4],
      60_000,
    );
    expect(findChargePoint(readings, 60_000)?.values.bt).toBeCloseTo(183.8 + 0.6 * 2, 5);
  });

  it('gives nothing while BT is still climbing or holding', () => {
    expect(findChargePoint(series(preheat(40), 60_000), 60_000)).toBeUndefined();
    const holding = series(
      Array.from({ length: 40 }, (_, i) => 190 + (i % 2) * 0.4),
      60_000,
    );
    expect(findChargePoint(holding, 60_000)).toBeUndefined();
  });

  it('ignores drops at 77 °C or below, as Artisan does', () => {
    expect(
      findChargePoint(series([70, 71, 72, 73, 74, 60, 50, 45], 60_000), 60_000),
    ).toBeUndefined();
  });

  it('only looks at the minute before the press, and skips readings without BT', () => {
    const old = series([...preheat(10), 186, 170, 150], 10_000);
    const later = series(preheat(30, 100), 10_000 + CHARGE_LOOKBACK_MS + 30_000);
    expect(
      findChargePoint([...old, ...later], 10_000 + CHARGE_LOOKBACK_MS + 30_000),
    ).toBeUndefined();
    const gappy = series([...preheat(10), 186, 170, 150], 60_000).map((r, i) =>
      i === 3 ? { ...r, values: {} } : r,
    );
    expect(findChargePoint(gappy, 60_000)?.values.bt).toBe(186);
    expect(findChargePoint([], 60_000)).toBeUndefined();
  });
});
