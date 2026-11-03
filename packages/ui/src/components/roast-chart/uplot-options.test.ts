import type uPlot from 'uplot';
import { describe, expect, it } from 'vitest';
import { MIN_TIME_SPAN_S, TIME_RANGE } from './uplot-options';

const range = (min: number, max: number) => TIME_RANGE({} as uPlot, min, max, 'x');

describe('time axis', () => {
  it('shows at least a minute, so the first seconds have readable ticks', () => {
    expect(range(0, 3.2)).toEqual([0, MIN_TIME_SPAN_S]);
  });

  it('follows the data once it spans more', () => {
    expect(range(-40.5, 300.2)).toEqual([-41, 301]);
  });

  it('copes with no data yet', () => {
    expect(range(Number.NaN, Number.NaN)).toEqual([0, MIN_TIME_SPAN_S]);
  });
});
