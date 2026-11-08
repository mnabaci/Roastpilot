import type { AutoProfile, ProfileEntry } from '@roastpilot/shared';
import { useMemo } from 'react';
import { useDeps } from '../../app/app-context';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { useAuto } from '../../stores/use-stores';
import { draftInUnit } from './draft-units';
import { fromDraft, toDraft, type DraftErrors, type ProfileDraft } from './profile-draft';

export interface ProfileDraftState {
  draft: ProfileDraft;
  /** Differs from what is saved. */
  edited: boolean;
  errors: DraftErrors;
  /** The profile the draft makes; undefined while it has problems. */
  valid: AutoProfile | undefined;
  change: (next: ProfileDraft) => void;
  discard: () => void;
}

const sameDraft = (a: ProfileDraft, b: ProfileDraft) => JSON.stringify(a) === JSON.stringify(b);

/** A profile's draft, kept in the store so it survives moving between screens and profiles. */
export function useProfileDraft({ profile }: ProfileEntry): ProfileDraftState {
  const { stores } = useDeps();
  const unit = useTemperatureUnit();
  const keptAsTyped = useAuto((s) => s.drafts[profile.id]);
  // A draft kept from before the unit changed reads in the unit now shown.
  const kept = useMemo(
    () => (keptAsTyped ? draftInUnit(keptAsTyped, unit) : undefined),
    [keptAsTyped, unit],
  );
  const saved = useMemo(() => toDraft(profile, unit), [profile, unit]);
  const draft = kept ?? saved;
  const checked = useMemo(() => fromDraft(draft, profile), [draft, profile]);
  const forget = () => {
    stores.auto.setState((s) => {
      const entries = Object.entries(s.drafts).filter(([id]) => id !== profile.id);
      return { drafts: Object.fromEntries(entries) };
    });
  };
  return {
    draft,
    edited: !sameDraft(draft, saved),
    errors: checked.ok ? {} : checked.error,
    valid: checked.ok ? checked.value : undefined,
    change: (next) => {
      // An edit undone by hand is no edit: the list's Edited badge reads the kept drafts.
      if (sameDraft(next, saved)) {
        forget();
        return;
      }
      stores.auto.setState((s) => ({ drafts: { ...s.drafts, [profile.id]: next } }));
    },
    discard: forget,
  };
}
