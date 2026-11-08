import { describe, expect, it } from 'vitest';
import { labelRows, labelX } from './draw-markers';

describe('labelRows', () => {
  it('keeps labels on the top row while they fit', () => {
    expect(
      labelRows(
        [
          { x: 0, width: 50 },
          { x: 100, width: 50 },
        ],
        8,
      ),
    ).toEqual([0, 0]);
  });

  it('moves a label down when it would run into the one before', () => {
    expect(
      labelRows(
        [
          { x: 0, width: 80 },
          { x: 60, width: 40 },
          { x: 200, width: 40 },
        ],
        8,
      ),
    ).toEqual([0, 1, 0]);
  });

  it('uses a third row when two are taken', () => {
    expect(
      labelRows(
        [
          { x: 0, width: 80 },
          { x: 20, width: 80 },
          { x: 40, width: 80 },
        ],
        8,
      ),
    ).toEqual([0, 1, 2]);
  });

  it('skips a row blocked for a label, keeping the others where they were', () => {
    expect(
      labelRows(
        [
          { x: 0, width: 50 },
          { x: 100, width: 50 },
        ],
        8,
        (row, index) => index === 1 && row === 0,
      ),
    ).toEqual([0, 1]);
  });
});

describe('labelX', () => {
  it('sits right of the line, or left of it near the edge', () => {
    expect(labelX(100, 50, 500, 8)).toBe(108);
    expect(labelX(480, 50, 500, 8)).toBe(422);
  });
});
