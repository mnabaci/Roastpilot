import type { RoastSummary } from '@roastpilot/shared';

export const ALL = 'all';
export const NO_BEAN = 'no-bean';
export const MANUAL = 'manual';

export interface RoastFilter {
  /** A bean's id, `all` or `no-bean`. */
  bean: string;
  /** A profile's id, `all` or `manual`. */
  profile: string;
  favourites: boolean;
}

export const NO_FILTER: RoastFilter = { bean: ALL, profile: ALL, favourites: false };

export function filterRoasts(
  roasts: readonly RoastSummary[],
  { bean, profile, favourites }: RoastFilter,
): RoastSummary[] {
  return roasts.filter(
    (r) =>
      (bean === ALL || (bean === NO_BEAN ? r.beanId === null : String(r.beanId) === bean)) &&
      (profile === ALL || (profile === MANUAL ? r.profileId === null : r.profileId === profile)) &&
      (!favourites || r.isFavourite),
  );
}

/** The profiles the roasts ran, each once, by name. */
export function profileOptions(
  roasts: readonly RoastSummary[],
): readonly { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const { profileId, profileName } of roasts) {
    if (profileId !== null) seen.set(profileId, profileName ?? profileId);
  }
  return [...seen].map(([value, label]) => ({ value, label }));
}
