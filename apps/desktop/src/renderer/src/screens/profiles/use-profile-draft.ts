import type { AutoProfile, ProfileEntry } from '@roastpilot/shared';
import { useMemo } from 'react';
import { useDeps } from '../../app/app-context';
import { useAuto } from '../../stores/use-stores';
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

/** A profile's draft, kept in the store so it survives moving between screens and profiles. */
export function useProfileDraft({ profile }: ProfileEntry): ProfileDraftState {
  const { stores } = useDeps();
  const kept = useAuto((s) => s.drafts[profile.id]);
  const saved = useMemo(() => toDraft(profile), [profile]);
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
    edited: JSON.stringify(draft) !== JSON.stringify(saved),
    errors: checked.ok ? {} : checked.error,
    valid: checked.ok ? checked.value : undefined,
    change: (next) => {
      stores.auto.setState((s) => ({ drafts: { ...s.drafts, [profile.id]: next } }));
    },
    discard: forget,
  };
}
