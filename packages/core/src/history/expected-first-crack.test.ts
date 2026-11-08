import { describe, expect, it } from 'vitest';
import { expectedFirstCrackC, type FirstCrackRoast } from './expected-first-crack';

const roast = (
  id: number,
  fcTemp: number | null,
  roasterId: number | null = 1,
): FirstCrackRoast => ({
  // A higher id is a newer roast.
  startedAt: `2026-11-${String(id).padStart(2, '0')}T09:00:00.000Z`,
  fcTemp,
  roasterId,
});

describe('expectedFirstCrackC', () => {
  it('is the median BT at first crack of the last 5 roasts that had one', () => {
    const roasts = [
      roast(1, 150), // sixth newest with a crack: left out
      roast(2, 196),
      roast(3, 194),
      roast(4, null),
      roast(5, 198),
      roast(6, 195),
      roast(7, 200),
    ];
    expect(expectedFirstCrackC(roasts, 1)).toBe(196);
  });

  it('averages the two middle ones of an even count', () => {
    expect(expectedFirstCrackC([roast(1, 194), roast(2, 198)], 1)).toBe(196);
  });

  it("prefers this roaster's roasts, and falls back on all of them", () => {
    const roasts = [roast(1, 190, 1), roast(2, 205, 2)];
    expect(expectedFirstCrackC(roasts, 2)).toBe(205);
    expect(expectedFirstCrackC(roasts, 3)).toBe(197.5);
    expect(expectedFirstCrackC(roasts, undefined)).toBe(197.5);
  });

  it('is undefined without a saved first crack', () => {
    expect(expectedFirstCrackC([], 1)).toBeUndefined();
    expect(expectedFirstCrackC([roast(1, null)], 1)).toBeUndefined();
  });
});
