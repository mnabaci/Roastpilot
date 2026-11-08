import type uPlot from 'uplot';
import { describe, expect, it } from 'vitest';
import { MIN_TIME_SPAN_S, ROR_RANGE, temperatureRange, TIME_RANGE } from './scales';

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

const temperature = (min: number, max: number) =>
  temperatureRange(() => 0)({} as uPlot, min, max, 'temperature');

describe('temperature axis', () => {
  it('stays at 0–250 °C, so sensor jitter is invisible', () => {
    expect(temperature(37.5, 38.1)).toEqual([0, 250]);
    expect(temperature(180, 250)).toEqual([0, 250]);
  });

  it('grows in 50 °C steps past 250 °C', () => {
    expect(temperature(200, 251)).toEqual([0, 300]);
  });

  it('copes with no data yet', () => {
    expect(temperature(Number.NaN, Number.NaN)).toEqual([0, 250]);
  });

  it('starts at the floor it is given, read each time, still growing past 250 °C', () => {
    let floorC = 50;
    const focused = temperatureRange(() => floorC);
    expect(focused({} as uPlot, 92, 210, 'temperature')).toEqual([50, 250]);
    expect(focused({} as uPlot, 92, 262, 'temperature')).toEqual([50, 300]);
    floorC = 0;
    expect(focused({} as uPlot, 92, 210, 'temperature')).toEqual([0, 250]);
  });

  it('grows for an aid drawn hotter than the data, so the projection is never cut off', () => {
    const withProjection = (topC: number | undefined) =>
      temperatureRange(
        () => 75,
        () => topC,
      )({} as uPlot, 92, 224, 'temperature');
    expect(withProjection(251.6)).toEqual([75, 300]);
    expect(withProjection(240)).toEqual([75, 250]);
    expect(withProjection(undefined)).toEqual([75, 250]);
  });
});

const ror = (min: number, max: number) => ROR_RANGE({} as uPlot, min, max, 'ror');

describe('RoR axis', () => {
  it('shows at least 0–30 °C/min', () => {
    expect(ror(4.2, 12.8)).toEqual([0, 30]);
  });

  it('widens when RoR goes outside', () => {
    expect(ror(-6.5, 41.2)).toEqual([-7, 42]);
  });

  it('copes with no RoR yet', () => {
    expect(ror(Number.NaN, Number.NaN)).toEqual([0, 30]);
  });
});
