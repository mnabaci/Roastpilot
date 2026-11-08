import type { Reading } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { ROR_TREND, rorTrend } from './ror-trend';

/** One reading a second for `s` seconds, BT from the function of time. */
const readings = (s: number, bt: (t: number) => number): Reading[] =>
  Array.from({ length: s + 1 }, (_, t) => ({ atMs: t * 1_000, values: { bt: bt(t) } }));

describe('rorTrend', () => {
  it('is steady on a straight climb', () => {
    expect(rorTrend(readings(90, (t) => 100 + t / 6))).toBe('steady');
  });

  it('is rising when RoR grows, and falling when it shrinks', () => {
    expect(rorTrend(readings(90, (t) => 100 + (t * t) / 400))).toBe('rising');
    expect(rorTrend(readings(90, (t) => 100 + t / 2 - (t * t) / 400))).toBe('falling');
  });

  it(`stays steady for a change under ${String(ROR_TREND.deadBandC)} °C/min`, () => {
    // RoR grows by 0.6 °C/min every 20 s.
    expect(rorTrend(readings(90, (t) => 100 + t / 6 + (t * t) / 4000))).toBe('steady');
  });

  it('is unknown until RoR has a value now and a while ago', () => {
    expect(rorTrend([])).toBeUndefined();
    expect(rorTrend(readings(40, (t) => 100 + t / 6))).toBeUndefined();
    expect(rorTrend(readings(55, (t) => 100 + t / 6))).toBe('steady');
  });
});
