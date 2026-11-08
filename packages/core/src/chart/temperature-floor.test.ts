import { describe, expect, it } from 'vitest';
import { ManualClock } from '../clock';
import { expectedTurningPointC, nextFloorC, startFloorC } from './temperature-floor';

describe('expectedTurningPointC', () => {
  it("takes the ghost's TP, else the plan's, else the saved roasts'", () => {
    expect(expectedTurningPointC({ ghostC: 86, planC: 92, savedC: 90 })).toBe(86);
    expect(expectedTurningPointC({ ghostC: undefined, planC: 92, savedC: 90 })).toBe(92);
    expect(expectedTurningPointC({ ghostC: undefined, planC: undefined, savedC: 90 })).toBe(90);
  });

  it('is none with no history, no plan and a ghost without a TP', () => {
    expect(
      expectedTurningPointC({ ghostC: undefined, planC: undefined, savedC: undefined }),
    ).toBeUndefined();
  });
});

describe('startFloorC', () => {
  it('is TP − 15 °C rounded down to a multiple of 25', () => {
    expect(startFloorC(88)).toBe(50);
    expect(startFloorC(95)).toBe(75);
    expect(startFloorC(90)).toBe(75);
    expect(startFloorC(89.9)).toBe(50);
  });

  it('is 50 °C with no TP to expect, and never below 0', () => {
    expect(startFloorC(undefined)).toBe(50);
    expect(startFloorC(10)).toBe(0);
  });
});

describe('nextFloorC', () => {
  /** Redraws once a second from Start with the lowest drawn temperature at each second. */
  function roast(floorAtStart: number, lowestAt: (s: number) => number, seconds: number) {
    const clock = new ManualClock();
    const floors: number[] = [];
    let floor = floorAtStart;
    for (let s = 0; s < seconds; s++) {
      floor = nextFloorC(floor, lowestAt(clock.now() / 1000));
      floors.push(floor);
      clock.advance(1000);
    }
    return floors;
  }

  it('stays put while every line stays above it', () => {
    expect(roast(75, () => 88, 5)).toEqual([75, 75, 75, 75, 75]);
  });

  it('steps straight down to fit a glitch reading, then never moves back up', () => {
    // A 12 °C glitch reading at 0:02, gone a second later.
    const floors = roast(75, (s) => (s === 2 ? 12 : 88), 6);
    expect(floors).toEqual([75, 75, 0, 0, 0, 0]);
  });

  it('goes only as far down as the lowest line needs, to a multiple of 25', () => {
    expect(nextFloorC(75, 62)).toBe(50);
    expect(nextFloorC(75, 50)).toBe(50);
    expect(nextFloorC(75, 49.9)).toBe(25);
  });

  it('stays put for a line exactly at the floor', () => {
    expect(nextFloorC(75, 75)).toBe(75);
  });

  it('never goes below 0', () => {
    expect(nextFloorC(0, -5)).toBe(0);
  });

  it('does nothing without a drawn line', () => {
    expect(nextFloorC(50, undefined)).toBe(50);
  });
});
