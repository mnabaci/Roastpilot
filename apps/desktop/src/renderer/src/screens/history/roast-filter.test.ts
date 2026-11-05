import type { RoastSummary } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { filterRoasts, NO_FILTER, profileOptions } from './roast-filter';

const roast = (id: number, beanId: number | null, profileId: string | null, isFavourite = false) =>
  ({
    id,
    beanId,
    profileId,
    profileName: profileId?.toUpperCase() ?? null,
    isFavourite,
  }) as RoastSummary;

const ROASTS = [roast(1, 1, 'a', true), roast(2, 2, 'a'), roast(3, null, null)];
const ids = (filter: Partial<typeof NO_FILTER>) =>
  filterRoasts(ROASTS, { ...NO_FILTER, ...filter }).map((r) => r.id);

describe('filterRoasts', () => {
  it('shows all with no filter', () => {
    expect(ids({})).toEqual([1, 2, 3]);
  });
  it('filters by bean, or no bean', () => {
    expect(ids({ bean: '2' })).toEqual([2]);
    expect(ids({ bean: 'no-bean' })).toEqual([3]);
  });
  it('filters by profile, or Manual', () => {
    expect(ids({ profile: 'a' })).toEqual([1, 2]);
    expect(ids({ profile: 'manual' })).toEqual([3]);
  });
  it('filters favourites, on top of the rest', () => {
    expect(ids({ favourites: true })).toEqual([1]);
    expect(ids({ favourites: true, bean: '2' })).toEqual([]);
  });
});

describe('profileOptions', () => {
  it('lists each profile the roasts ran once', () => {
    expect(profileOptions(ROASTS)).toEqual([{ value: 'a', label: 'A' }]);
  });
});
