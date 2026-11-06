import type { Bean, RoastSummary } from '@roastpilot/shared';

export interface ProfileSuggestion {
  profileId: string;
  /** One line on why, e.g. "Your favourite roast of this bean". */
  reason: string;
  /** The favourite it came from; undefined for a bean's own profile or the fallback. */
  roastId?: number;
}

type Favourite = Pick<RoastSummary, 'id' | 'isFavourite' | 'rating' | 'startedAt' | 'beanId'>;

/** Starred, highest rating, then most recent. */
export function bestFavourite<R extends Favourite>(roasts: readonly R[]): R | undefined {
  return roasts
    .filter((r) => r.isFavourite)
    .toSorted(
      (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.startedAt.localeCompare(a.startedAt),
    )[0];
}

const closeness = (a: number | null, b: number | null): number =>
  a === null || b === null ? Infinity : Math.abs(a - b);

/** Most similar first: process and decaf are the filter, then density, altitude and origin. */
function bySimilarity(bean: Bean, others: readonly Bean[]): Bean[] {
  return others
    .filter((b) => b.id !== bean.id && b.process === bean.process && b.decaf === bean.decaf)
    .toSorted(
      (a, b) =>
        closeness(a.densityGL, bean.densityGL) - closeness(b.densityGL, bean.densityGL) ||
        closeness(a.altitudeM, bean.altitudeM) - closeness(b.altitudeM, bean.altitudeM) ||
        Number(b.origin === bean.origin) - Number(a.origin === bean.origin),
    );
}

const beanLabel = (bean: Bean): string =>
  bean.densityGL === null
    ? `${bean.origin} ${bean.process}`
    : `${bean.origin} ${bean.process}, ${String(bean.densityGL)} g/L`;

/**
 * The profile to start from (docs/spec/beans-favourites-ghost.md, Profile suggestion), among the
 * ones the active roaster has. Favourites on Manual or with a profile that is gone are skipped.
 */
export function suggestProfile(input: {
  bean: Bean | undefined;
  beans: readonly Bean[];
  roasts: readonly (Favourite & { profileId: string | null })[];
  available: readonly string[];
}): ProfileSuggestion | undefined {
  const { bean, beans, roasts, available } = input;
  const [fallback] = available;
  if (fallback === undefined) return undefined;
  const usable = roasts.filter((r) => r.profileId !== null && available.includes(r.profileId));
  const favouriteOf = (id: number) => bestFavourite(usable.filter((r) => r.beanId === id));
  const from = (r: { id: number; profileId: string | null }, reason: string) => ({
    profileId: r.profileId ?? fallback,
    reason,
    roastId: r.id,
  });
  if (bean) {
    if (bean.profileId !== null && available.includes(bean.profileId)) {
      return { profileId: bean.profileId, reason: "This bean's own profile" };
    }
    const own = favouriteOf(bean.id);
    if (own) return from(own, 'Your favourite roast of this bean');
    for (const similar of bySimilarity(bean, beans)) {
      const favourite = favouriteOf(similar.id);
      if (favourite) return from(favourite, `Closest bean you've starred: ${beanLabel(similar)}`);
    }
    const sameKind = beans.filter((b) => b.id !== bean.id && b.decaf === bean.decaf);
    const ids = new Set(sameKind.map((b) => b.id));
    const broad = bestFavourite(usable.filter((r) => r.beanId !== null && ids.has(r.beanId)));
    if (broad) return from(broad, 'Your best favourite of a similar bean');
  }
  return { profileId: fallback, reason: 'Nothing starred to go on yet' };
}

/**
 * The ghost to compare with: the bean's best favourite, else the profile's most recent favourite,
 * else none (docs/spec/beans-favourites-ghost.md, Ghost layer).
 */
export function defaultGhost<R extends Favourite & { profileId: string | null }>(input: {
  beanId: number | null;
  profileId: string | null;
  roasts: readonly R[];
}): R | undefined {
  const { beanId, profileId, roasts } = input;
  const ofBean =
    beanId === null ? undefined : bestFavourite(roasts.filter((r) => r.beanId === beanId));
  if (ofBean) return ofBean;
  return roasts
    .filter((r) => r.isFavourite && profileId !== null && r.profileId === profileId)
    .toSorted((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}
