import { describe, expect, it } from 'vitest';
import { crossesAny, labelSpot, type Box } from './band-labels';

const bottom: Box = { left: 40, top: 200, right: 120, bottom: 218 };
const top: Box = { left: 40, top: 120, right: 120, bottom: 138 };

describe('crossesAny', () => {
  it('sees a line running through the box, and one passing by', () => {
    expect(
      crossesAny(bottom, [
        [
          { x: 0, y: 210 },
          { x: 200, y: 210 },
        ],
      ]),
    ).toBe(true);
    expect(
      crossesAny(bottom, [
        [
          { x: 0, y: 100 },
          { x: 200, y: 100 },
        ],
      ]),
    ).toBe(false);
  });

  it('sees a steep segment that jumps across the box between two points', () => {
    expect(
      crossesAny(bottom, [
        [
          { x: 60, y: 150 },
          { x: 64, y: 260 },
        ],
      ]),
    ).toBe(true);
  });

  it('does not join across a break', () => {
    expect(crossesAny(bottom, [[{ x: 0, y: 150 }, null, { x: 200, y: 260 }]])).toBe(false);
  });
});

describe('labelSpot', () => {
  it('takes the bottom of the band when it is clear', () => {
    expect(
      labelSpot(
        [bottom, top],
        [
          [
            { x: 0, y: 100 },
            { x: 200, y: 100 },
          ],
        ],
      ),
    ).toBe(bottom);
  });

  it('moves to the top when a curve crosses the bottom, as the drop after charge does', () => {
    expect(
      labelSpot(
        [bottom, top],
        [
          [
            { x: 60, y: 150 },
            { x: 64, y: 260 },
          ],
        ],
      ),
    ).toBe(top);
  });

  it('names nothing when every spot is crossed', () => {
    expect(
      labelSpot(
        [bottom, top],
        [
          [
            { x: 0, y: 100 },
            { x: 200, y: 260 },
          ],
        ],
      ),
    ).toBeUndefined();
  });
});
