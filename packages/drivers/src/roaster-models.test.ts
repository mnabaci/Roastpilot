import { describe, expect, it } from 'vitest';
import { BUILT_IN_ROASTERS, newRoaster } from './roaster-models';

describe('newRoaster', () => {
  it('a Skywalker has the bean cooler helping cool the drum; a Simulator does not', () => {
    expect(newRoaster('A', 'skywalker').coolerHelpsDrum).toBe(true);
    expect(newRoaster('B', 'simulator').coolerHelpsDrum).toBe(false);
  });

  it('the built-in records match what migration 0005 sets', () => {
    expect(BUILT_IN_ROASTERS.map((r) => [r.model, r.coolerHelpsDrum])).toEqual([
      ['skywalker', true],
      ['simulator', false],
    ]);
  });
});
