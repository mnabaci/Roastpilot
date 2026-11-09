import { useState } from 'react';
import type { StepDraft } from './profile-draft';
import { keepStepIds, type StepIds } from './step-drag';

let last = 0;
const newId = (): string => `step-${String(++last)}`;

/** Ids that stay with their steps across edits and moves (keepStepIds): row keys and drag ids. */
export function useStepIds(steps: readonly StepDraft[]): readonly string[] {
  const [seen, setSeen] = useState<StepIds>(() => ({
    steps,
    ids: keepStepIds({ steps: [], ids: [] }, steps, newId),
  }));
  if (seen.steps === steps) return seen.ids;
  // The steps changed: work out their ids now, so this render already uses them.
  const next = { steps, ids: keepStepIds(seen, steps, newId) };
  setSeen(next);
  return next.ids;
}
