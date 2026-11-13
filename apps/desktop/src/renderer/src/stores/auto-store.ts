import { AUTO_OFF, type AutoStatus, type ProfileEntry } from '@roastpilot/shared';
import type { ProfileDraft } from '../screens/profiles/profile-draft';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface AutoData {
  status: AutoStatus;
  /** Built-ins and your own, as main listed them. */
  profiles: ProfileEntry[];
  /** Edits not saved yet, by profile id; they last until Save, Discard or quitting. */
  drafts: Readonly<Record<string, ProfileDraft>>;
}

export type AutoStore = StoreApi<AutoData>;

export const createAutoStore = (
  status: AutoStatus = AUTO_OFF,
  profiles: ProfileEntry[] = [],
): AutoStore => createStore(() => ({ status, profiles, drafts: {} }));

/**
 * A write's own answer, merged in so the screen needn't wait for main's pushed list (the two
 * aren't ordered). The push replaces the whole list, so merging twice is harmless.
 */
export const upsertProfile = (store: AutoStore, entry: ProfileEntry): void => {
  store.setState(({ profiles }) => ({
    profiles: profiles.some((e) => e.profile.id === entry.profile.id)
      ? profiles.map((e) => (e.profile.id === entry.profile.id ? entry : e))
      : [...profiles, entry],
  }));
};

/** The same for deletes: gone now, and gone in the pushed list too. */
export const removeProfiles = (store: AutoStore, ids: readonly string[]): void => {
  store.setState(({ profiles }) => ({
    profiles: profiles.filter((e) => !ids.includes(e.profile.id)),
  }));
};
