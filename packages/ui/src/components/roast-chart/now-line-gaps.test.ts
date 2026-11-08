import { describe, expect, it } from 'vitest';
import { nowLineSegments } from './now-line-gaps';

const label = (left: number, right: number, top: number, bottom: number) => ({
  left,
  right,
  top,
  bottom,
});

describe('nowLineSegments', () => {
  it('runs top to bottom when no label is in its way', () => {
    expect(nowLineSegments(100, 0, 300, [label(10, 60, 20, 34)], 2)).toEqual([[0, 300]]);
  });

  it('breaks under a label it would cross, with a little room each side', () => {
    expect(nowLineSegments(100, 0, 300, [label(80, 140, 20, 34)], 2)).toEqual([
      [0, 18],
      [36, 300],
    ]);
  });

  it('merges labels that touch, and skips one at the very top', () => {
    const labels = [label(90, 120, 0, 14), label(90, 120, 40, 54), label(95, 130, 52, 66)];
    expect(nowLineSegments(100, 0, 300, labels, 2)).toEqual([
      [16, 38],
      [68, 300],
    ]);
  });
});
