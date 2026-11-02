import type { Reading } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { rateOfRise } from './rate-of-rise';

/** One reading per second for `seconds` + 1 readings, BT = f(t in s). */
const series = (seconds: number, bt: (s: number) => number): Reading[] =>
  Array.from({ length: seconds + 1 }, (_, s) => ({ atMs: s * 1000, values: { bt: bt(s) } }));

describe('rateOfRise', () => {
  it('is the slope in °C per minute', () => {
    expect(rateOfRise(series(60, (s) => 100 + s * 0.2))).toBeCloseTo(12);
  });

  it('only looks at the last 30 s', () => {
    const readings = series(120, (s) => (s < 90 ? 100 + s : 190));
    expect(rateOfRise(readings)).toBeCloseTo(0);
  });

  it('is negative when BT falls, like right after charge', () => {
    expect(rateOfRise(series(30, (s) => 200 - s))).toBeCloseTo(-60);
  });

  it('smooths out sensor noise', () => {
    expect(rateOfRise(series(30, (s) => 150 + s * 0.15 + (s % 2 ? 0.3 : -0.3)))).toBeCloseTo(9, 0);
  });

  it('waits until the readings cover the window', () => {
    expect(rateOfRise(series(20, (s) => s))).toBeUndefined();
    expect(rateOfRise([])).toBeUndefined();
  });

  it('skips readings without a temperature', () => {
    const readings = series(30, (s) => 100 + s);
    readings[10] = { atMs: 10_000, values: { heater: 50 } };
    expect(rateOfRise(readings)).toBeCloseTo(60);
  });
});
