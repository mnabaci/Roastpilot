import { describe, expect, it } from 'vitest';
import { savedTurningPointC, type TurningPointRoast } from './expected-turning-point';

const roast = (
  id: number,
  tpTemp: number | null | undefined,
  roasterId = 1,
): TurningPointRoast => ({
  startedAt: `2026-11-${String(id).padStart(2, '0')}T09:00:00.000Z`,
  roasterId,
  ...(tpTemp === undefined ? {} : { tpTemp }),
});

describe('savedTurningPointC', () => {
  it('is the median TP of the last 5 roasts that had one', () => {
    const roasts = [
      roast(1, 70),
      roast(2, 88),
      roast(3, 92),
      roast(4, null),
      roast(5, 90),
      roast(6, 86),
      roast(7, 95),
    ];
    expect(savedTurningPointC(roasts, 1)).toBe(90);
  });

  it("prefers this roaster's roasts, and reads summaries from before TP was listed as none", () => {
    expect(savedTurningPointC([roast(1, 80, 2), roast(2, 92, 1), roast(3, undefined, 1)], 1)).toBe(
      92,
    );
    expect(savedTurningPointC([roast(1, undefined)], 1)).toBeUndefined();
  });
});
