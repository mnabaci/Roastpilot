import type { RoastSummary } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { beanRoastRows } from './bean-roast-rows';

const roast = (over: Partial<RoastSummary> = {}): RoastSummary => ({
  id: 17,
  startedAt: '2026-11-08T16:45:33.000Z',
  endedAt: '2026-11-08T17:00:53.000Z',
  fcTimeS: 514.4,
  fcTemp: null,
  dropTimeS: 620,
  dropTemp: 197,
  roasterId: 1,
  beanId: 1,
  ghostRoastId: null,
  batchG: 356,
  roastedG: 305,
  rating: 5,
  isFavourite: false,
  notes: null,
  profileId: 'light-curve',
  profileName: 'Light · Curve',
  imported: false,
  ...over,
});

describe('beanRoastRows', () => {
  it('gives each number its own cell, with how the roast ran', () => {
    expect(beanRoastRows([roast()], 'c')[0]).toMatchObject({
      ran: 'Auto · Light · Curve',
      time: '10:20',
      fc: '8:34',
      drop: '197.0 °C',
      weights: '356 → 305 g',
      loss: '14.3 %',
      rating: '5/5',
    });
  });

  it('leaves out what a roast never had: no first crack, roasted weight, loss or rating', () => {
    const manual = roast({ profileName: null, fcTimeS: null, roastedG: null, rating: null });
    expect(beanRoastRows([manual], 'c')[0]).toMatchObject({
      ran: 'Manual',
      fc: undefined,
      weights: '356 g',
      loss: undefined,
      rating: undefined,
    });
    expect(
      beanRoastRows([roast({ batchG: null, roastedG: null })], 'c')[0]?.weights,
    ).toBeUndefined();
  });
});
