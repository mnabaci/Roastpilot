import { describe, expect, it } from 'vitest';
import { findCrash, findFlick, findStall } from './ror-findings';

/** RoR one point a second from `fromS` to `toS`. */
const ror = (fromS: number, toS: number, at: (tS: number) => number) =>
  Array.from({ length: toS - fromS + 1 }, (_, i) => ({ tS: fromS + i, ror: at(fromS + i) }));

describe('findCrash', () => {
  it('finds RoR falling by half in under a minute after first crack', () => {
    // 9 at first crack (9:00), held a while, then down to 2 over 30 s, and it stays there.
    const series = ror(540, 660, (t) => (t < 570 ? 9 : t < 600 ? 9 - ((t - 570) / 30) * 7 : 2));
    expect(findCrash(series, 540, 660)).toEqual({
      kind: 'crash',
      atS: 540,
      fromRor: 9,
      toRor: 2,
    });
  });

  it('leaves a steady ease-off to drop alone', () => {
    const series = ror(540, 660, (t) => 8 - ((t - 540) / 120) * 4);
    expect(findCrash(series, 540, 660)).toBeUndefined();
  });

  it('needs a fall of at least 4 °C/min, however steep in share', () => {
    const series = ror(540, 660, (t) => (t < 560 ? 5 : 2));
    expect(findCrash(series, 540, 660)).toBeUndefined();
  });

  it('only looks between first crack and drop', () => {
    const series = ror(400, 700, (t) => (t < 500 ? 15 : t < 530 ? 6 : 6));
    expect(findCrash(series, 540, 660)).toBeUndefined();
  });
});

describe('findFlick', () => {
  it('finds RoR rising again before drop and staying up', () => {
    // Falls to 3 by 10:00, then back up to 5 from 10:20.
    const series = ror(540, 660, (t) => (t < 600 ? 8 - ((t - 540) / 60) * 5 : t < 620 ? 3 : 5));
    expect(findFlick(series, 540, 660)).toEqual({
      kind: 'flick',
      atS: 620,
      fromRor: 3,
      toRor: 5,
    });
  });

  it('ignores a blip shorter than 15 s', () => {
    const series = ror(540, 660, (t) => (t >= 620 && t < 630 ? 6 : 3));
    expect(findFlick(series, 540, 660)).toBeUndefined();
  });

  it("ignores the bump right after first crack: it's the crack itself", () => {
    const series = ror(540, 660, (t) => (t < 560 ? 4 : t < 570 ? 7 : 4 - (t - 570) / 60));
    expect(findFlick(series, 540, 660)).toBeUndefined();
  });

  it('leaves a steady ease-off alone', () => {
    const series = ror(540, 660, (t) => 8 - ((t - 540) / 120) * 4);
    expect(findFlick(series, 540, 660)).toBeUndefined();
  });
});

describe('findStall', () => {
  it('finds RoR under 3 °C/min for 30 s or more, with whether Auto tried to stop it', () => {
    const series = ror(300, 540, (t) => (t >= 400 && t < 450 ? 2 : 10));
    expect(findStall(series, 300, 540, [395])).toEqual({
      kind: 'stall',
      atS: 400,
      durationS: 49,
      minRor: 2,
      guarded: true,
    });
    expect(findStall(series, 300, 540, [])?.guarded).toBe(false);
  });

  it('keeps the longest of several', () => {
    const series = ror(300, 540, (t) => ((t >= 320 && t < 355) || (t >= 400 && t < 460) ? 1 : 10));
    expect(findStall(series, 300, 540, [])?.atS).toBe(400);
  });

  it('needs 30 s, and only counts inside the stretch it is given', () => {
    expect(
      findStall(
        ror(300, 540, (t) => (t >= 400 && t < 420 ? 1 : 10)),
        300,
        540,
        [],
      ),
    ).toBe(undefined);
    expect(
      findStall(
        ror(300, 540, (t) => (t >= 500 ? 1 : 10)),
        300,
        480,
        [],
      ),
    ).toBeUndefined();
  });
});
