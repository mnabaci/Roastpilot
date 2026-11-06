import type { Bean } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { bestFavourite, defaultGhost, suggestProfile } from './suggest-profile';

const bean = (id: number, change: Partial<Bean> = {}): Bean => ({
  id,
  name: `Bean ${String(id)}`,
  origin: 'Ethiopia',
  process: 'washed',
  variety: null,
  altitudeM: null,
  densityGL: null,
  moisturePct: null,
  screen: null,
  decaf: false,
  supplier: null,
  lowStockG: 500,
  notes: null,
  profileId: null,
  greenG: 1000,
  roastedG: 0,
  archived: false,
  avgLossPct: null,
  batchPlan: null,
  ...change,
});

const roast = (id: number, change = {}) => ({
  id,
  beanId: null as number | null,
  isFavourite: true,
  rating: null as number | null,
  startedAt: '2026-11-01T10:00:00.000Z',
  profileId: 'a' as string | null,
  ...change,
});

const available = ['first', 'a', 'b', 'c'];

describe('bestFavourite', () => {
  it('is starred, then highest rating, then most recent', () => {
    const roasts = [
      roast(1, { rating: 5, isFavourite: false }),
      roast(2, { rating: 3 }),
      roast(3, { rating: 4, startedAt: '2026-10-01T10:00:00.000Z' }),
      roast(4, { rating: 4, startedAt: '2026-11-01T10:00:00.000Z' }),
    ];
    expect(bestFavourite(roasts)?.id).toBe(4);
    expect(bestFavourite([roast(1, { isFavourite: false })])).toBeUndefined();
  });
});

describe('suggestProfile', () => {
  it('falls back on the first available with no bean or no favourites', () => {
    expect(suggestProfile({ bean: undefined, beans: [], roasts: [], available })).toEqual({
      profileId: 'first',
      reason: 'Nothing starred to go on yet',
    });
    expect(
      suggestProfile({ bean: bean(1), beans: [bean(1)], roasts: [], available })?.profileId,
    ).toBe('first');
  });

  it('has nothing to suggest with no profiles', () => {
    expect(suggestProfile({ bean: bean(1), beans: [], roasts: [], available: [] })).toBeUndefined();
  });

  it('prefers the bean own profile over its favourites', () => {
    const own = bean(1, { profileId: 'b' });
    const roasts = [roast(1, { beanId: 1 })];
    expect(suggestProfile({ bean: own, beans: [own], roasts, available })).toEqual({
      profileId: 'b',
      reason: "This bean's own profile",
    });
  });

  it('ignores the bean own profile when it is gone', () => {
    const own = bean(1, { profileId: 'gone' });
    const roasts = [roast(1, { beanId: 1, profileId: 'a' })];
    expect(suggestProfile({ bean: own, beans: [own], roasts, available })?.profileId).toBe('a');
  });

  it('uses the favourite of this bean first, and says so', () => {
    const roasts = [
      roast(1, { beanId: 2, profileId: 'b' }),
      roast(2, { beanId: 1, profileId: 'a' }),
    ];
    expect(suggestProfile({ bean: bean(1), beans: [bean(1), bean(2)], roasts, available })).toEqual(
      {
        profileId: 'a',
        reason: 'Your favourite roast of this bean',
        roastId: 2,
      },
    );
  });

  it('then the closest bean by density, in the same process and decaf', () => {
    const me = bean(1, { densityGL: 780 });
    const far = bean(2, { densityGL: 700 });
    const near = bean(3, { densityGL: 790 });
    const natural = bean(4, { densityGL: 780, process: 'natural' });
    const decaf = bean(5, { densityGL: 780, decaf: true });
    const roasts = [
      roast(1, { beanId: 2, profileId: 'a' }),
      roast(2, { beanId: 3, profileId: 'b' }),
      roast(3, { beanId: 4, profileId: 'c' }),
      roast(4, { beanId: 5, profileId: 'c' }),
    ];
    const beans = [me, far, near, natural, decaf];
    expect(suggestProfile({ bean: me, beans, roasts, available })).toEqual({
      profileId: 'b',
      reason: "Closest bean you've starred: Ethiopia washed, 790 g/L",
      roastId: 2,
    });
  });

  it('then altitude, then origin, when density says nothing', () => {
    const me = bean(1, { altitudeM: 1900, origin: 'Kenya' });
    const low = bean(2, { altitudeM: 1200 });
    const high = bean(3, { altitudeM: 1950 });
    const roasts = [
      roast(1, { beanId: 2, profileId: 'a' }),
      roast(2, { beanId: 3, profileId: 'b' }),
    ];
    expect(suggestProfile({ bean: me, beans: [me, low, high], roasts, available })?.profileId).toBe(
      'b',
    );
    const a = bean(4, { origin: 'Peru' });
    const b = bean(5, { origin: 'Kenya' });
    const byOrigin = [
      roast(3, { beanId: 4, profileId: 'a' }),
      roast(4, { beanId: 5, profileId: 'c' }),
    ];
    const plain = bean(1, { origin: 'Kenya' });
    expect(
      suggestProfile({ bean: plain, beans: [plain, a, b], roasts: byOrigin, available })?.profileId,
    ).toBe('c');
  });

  it('then any favourite of the same decaf or not, never crossing it', () => {
    const me = bean(1);
    const natural = bean(2, { process: 'natural' });
    const decaf = bean(3, { decaf: true });
    const roasts = [
      roast(1, { beanId: 3, profileId: 'c', rating: 5 }),
      roast(2, { beanId: 2, profileId: 'b' }),
    ];
    expect(suggestProfile({ bean: me, beans: [me, natural, decaf], roasts, available })).toEqual({
      profileId: 'b',
      reason: 'Your best favourite of a similar bean',
      roastId: 2,
    });
  });

  it('skips favourites on Manual, or whose profile is gone', () => {
    const roasts = [
      roast(1, { beanId: 1, profileId: null }),
      roast(2, { beanId: 1, profileId: 'gone' }),
    ];
    expect(suggestProfile({ bean: bean(1), beans: [bean(1)], roasts, available })?.profileId).toBe(
      'first',
    );
  });
});

describe('defaultGhost', () => {
  it('is the bean best favourite, a Manual one included', () => {
    const roasts = [
      roast(1, { beanId: 1, profileId: null, rating: 5 }),
      roast(2, { beanId: 1, rating: 2 }),
    ];
    expect(defaultGhost({ beanId: 1, profileId: 'a', roasts })?.id).toBe(1);
  });

  it('else the profile most recent favourite', () => {
    const roasts = [
      roast(1, { beanId: 2, startedAt: '2026-10-01T10:00:00.000Z' }),
      roast(2, { beanId: 2, startedAt: '2026-11-02T10:00:00.000Z' }),
      roast(3, { beanId: 2, profileId: 'b', startedAt: '2026-11-03T10:00:00.000Z' }),
    ];
    expect(defaultGhost({ beanId: 1, profileId: 'a', roasts })?.id).toBe(2);
  });

  it('else none', () => {
    expect(defaultGhost({ beanId: null, profileId: null, roasts: [roast(1)] })).toBeUndefined();
    expect(defaultGhost({ beanId: 1, profileId: 'z', roasts: [roast(1)] })).toBeUndefined();
  });
});
