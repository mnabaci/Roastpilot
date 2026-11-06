import { describe, expect, it } from 'vitest';
import { handleAt } from './drag-handles';

const POINTS = [
  { x: 100, y: 100 },
  { x: 120, y: 100 },
];

describe('handleAt', () => {
  it('picks the nearest handle within reach', () => {
    expect(handleAt(POINTS, 112, 100)).toBe(1);
    expect(handleAt(POINTS, 106, 100)).toBe(0);
  });

  it('finds nothing out of reach', () => {
    expect(handleAt(POINTS, 100, 130)).toBeUndefined();
    expect(handleAt([], 0, 0)).toBeUndefined();
  });
});
