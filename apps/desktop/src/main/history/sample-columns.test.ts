import type { SavedSample } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { fromColumns, toColumns } from './sample-columns';

const SAMPLES: SavedSample[] = [
  { tS: -39.024, values: { heater: 100, fan: 30, bt: 162.21 } },
  { tS: 0.98, values: { heater: 0, fan: 30, bt: 180.06, et: 201.44 } },
];

describe('sample columns', () => {
  it('names each channel once, with one value per time, rounded to 0.1', () => {
    expect(toColumns(SAMPLES)).toEqual({
      tS: [-39, 1],
      values: {
        heater: [100, 0],
        fan: [30, 30],
        bt: [162.2, 180.1],
        et: [null, 201.4],
      },
    });
  });

  it('comes back as the same samples, a missing channel left out', () => {
    expect(fromColumns(toColumns(SAMPLES))).toEqual([
      { tS: -39, values: { heater: 100, fan: 30, bt: 162.2 } },
      { tS: 1, values: { heater: 0, fan: 30, bt: 180.1, et: 201.4 } },
    ]);
  });

  it('keeps a roast with no samples empty', () => {
    expect(toColumns([])).toEqual({ tS: [], values: {} });
    expect(fromColumns({ tS: [], values: {} })).toEqual([]);
  });
});
