import type { RoastSummary } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { roastDetailsSummary } from './roast-details-summary';

const roast = (over: Partial<RoastSummary> = {}): RoastSummary => ({
  id: 1,
  startedAt: '2026-11-04T14:32:00.000Z',
  endedAt: '2026-11-04T14:50:00.000Z',
  fcTimeS: 480,
  fcTemp: null,
  dropTimeS: 580,
  dropTemp: 205.5,
  roasterId: null,
  beanId: 3,
  ghostRoastId: null,
  batchG: 356,
  roastedG: 305,
  rating: 5,
  isFavourite: false,
  notes: 'Third auto roast curve, sweet\nNext time: drop earlier',
  profileId: null,
  profileName: null,
  imported: false,
  ...over,
});
const BEANS = [{ id: 3, name: 'African Moon' }];

describe('roastDetailsSummary', () => {
  it('sums up bean, weights, loss, rating and the notes’ first line', () => {
    expect(roastDetailsSummary(roast(), BEANS)).toEqual({
      shown: 'African Moon · 356 → 305 g · 14.3 % · ★★★★★ · Third auto roast curve, sweet',
      spoken: 'African Moon · 356 → 305 g · 14.3 % · rated 5 of 5 · Third auto roast curve, sweet',
    });
  });

  it('shows a lower rating out of 5, and says Favourite when starred', () => {
    const summary = roastDetailsSummary(
      roast({ rating: 3, isFavourite: true, notes: null }),
      BEANS,
    );
    expect(summary?.shown).toBe('African Moon · 356 → 305 g · 14.3 % · ★★★☆☆ · Favourite');
    expect(summary?.spoken).toBe('African Moon · 356 → 305 g · 14.3 % · rated 3 of 5 · Favourite');
  });

  it('leaves out what the roast does not have', () => {
    const bare = roast({ beanId: null, roastedG: null, rating: null, notes: '  \n' });
    expect(roastDetailsSummary(bare, BEANS)?.shown).toBe('356 g');
    expect(roastDetailsSummary(roast({ batchG: null, beanId: 9 }), BEANS)?.shown).toMatch(
      /^305 g roasted · ★★★★★/,
    );
  });

  it('skips blank lines at the top of the notes', () => {
    expect(roastDetailsSummary(roast({ notes: '\n  Sweet  \nmore' }), BEANS)?.shown).toMatch(
      / · Sweet$/,
    );
  });

  it('is undefined when there is nothing to sum up', () => {
    const empty = roast({ beanId: null, batchG: null, roastedG: null, rating: null, notes: null });
    expect(roastDetailsSummary(empty, BEANS)).toBeUndefined();
  });
});
