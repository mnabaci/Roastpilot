import { describe, expect, it } from 'vitest';
import { minimise } from './nelder-mead';

describe('minimise', () => {
  it('finds the bottom of a bowl', () => {
    const bowl = ([x = 0, y = 0]: number[]) => (x - 3) ** 2 + 2 * (y + 1) ** 2;
    const { point, value } = minimise(bowl, [0, 0], { tolerance: 1e-12 });
    expect(point[0]).toBeCloseTo(3, 3);
    expect(point[1]).toBeCloseTo(-1, 3);
    expect(value).toBeCloseTo(0, 6);
  });

  it('follows a curved valley (Rosenbrock) to its minimum', () => {
    const { point } = minimise(
      ([x = 0, y = 0]) => (1 - x) ** 2 + 100 * (y - x * x) ** 2,
      [-1.2, 1],
      { step: 0.5, tolerance: 1e-12 },
    );
    expect(point[0]).toBeCloseTo(1, 2);
    expect(point[1]).toBeCloseTo(1, 2);
  });

  it('stops at the evaluation budget', () => {
    const { evaluations } = minimise(([x = 0]) => Math.abs(Math.sin(x * 1000)), [1], {
      maxEvaluations: 20,
      tolerance: 0,
    });
    expect(evaluations).toBeLessThanOrEqual(22);
  });

  it('returns the start when it is already the minimum', () => {
    const { point, value } = minimise(([x = 0]) => x * x, [0], { tolerance: 1e-12 });
    expect(Math.abs(point[0] ?? 1)).toBeLessThan(1e-3);
    expect(value).toBeLessThan(1e-6);
  });
});
