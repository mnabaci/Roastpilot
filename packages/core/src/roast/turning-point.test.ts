import type { Reading } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { findTurningPoint } from './turning-point';

/** One reading a second from charge at 0. */
const since = (bts: readonly (number | undefined)[]): Reading[] =>
  bts.map((bt, i): Reading => ({ atMs: i * 1000, values: bt === undefined ? {} : { bt } }));

/** Falls from 180 °C to `low` over `n` readings, then rises by `rise` per reading. */
function dip(n: number, low: number, risingFor: number, rise = 0.5): number[] {
  const fall = Array.from({ length: n }, (_, i) => 180 - ((180 - low) * (i + 1)) / n);
  return [...fall, ...Array.from({ length: risingFor }, (_, i) => low + rise * (i + 1))];
}

describe('findTurningPoint', () => {
  it('finds the lowest BT once it has risen for four readings', () => {
    const readings = since(dip(60, 92.2, 4));
    expect(findTurningPoint(readings, 0)).toEqual({ atMs: 59_000, values: { bt: 92.2 } });
    expect(findTurningPoint(since(dip(60, 92.2, 3)), 0)).toBeUndefined();
  });

  it('waits until 20 s after charge', () => {
    expect(findTurningPoint(since(dip(10, 120, 8)), 0)).toBeUndefined();
    expect(findTurningPoint(since(dip(10, 120, 12)), 0)?.values.bt).toBe(120);
  });

  it('holds off while one of the last four readings is below the one before them', () => {
    // The last five: 93, 93.5, 92.8, 93.6, 94 — one is below the first.
    const wobble = [...dip(60, 92, 0), 92.5, 93, 93.5, 92.8, 93.6, 94];
    expect(findTurningPoint(since(wobble), 0)).toBeUndefined();
  });

  it('a flat stretch is not a turn: the last reading must be higher', () => {
    expect(findTurningPoint(since([...dip(60, 92, 0), 92, 92, 92, 92]), 0)).toBeUndefined();
  });

  it('ignores a turning point outside 50–150 °C, as a probe glitch', () => {
    expect(findTurningPoint(since(dip(40, 30, 6)), 0)).toBeUndefined();
    expect(
      findTurningPoint(since([...Array<number>(30).fill(160), 161, 162, 163, 164]), 0),
    ).toBeUndefined();
  });

  it('counts only readings since charge, and skips readings without BT', () => {
    const before = { atMs: -5000, values: { bt: 60 } };
    const readings = [
      before,
      ...since(dip(60, 92, 4)).map((r, i) => (i === 10 ? { ...r, values: {} } : r)),
    ];
    expect(findTurningPoint(readings, 0)?.values.bt).toBe(92);
    expect(findTurningPoint([], 0)).toBeUndefined();
  });
});
