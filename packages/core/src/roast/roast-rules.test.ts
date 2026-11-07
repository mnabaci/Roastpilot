import { describe, expect, it } from 'vitest';
import { phaseOutputs } from './roast-rules';

describe('phaseOutputs', () => {
  it('keeps the drum, at its on value, and the filter fan running from Preheat to Cooling', () => {
    for (const phase of ['preheat', 'roasting', 'development', 'cooling'] as const) {
      expect(phaseOutputs(phase, 60)).toEqual([
        ['drum', 60],
        ['filter', 1],
      ]);
    }
    expect(phaseOutputs('roasting', 1)).toContainEqual(['drum', 1]);
  });

  it('runs nothing in Ready and Done', () => {
    expect(phaseOutputs('ready', 60)).toEqual([]);
    expect(phaseOutputs('done', 60)).toEqual([]);
  });
});
