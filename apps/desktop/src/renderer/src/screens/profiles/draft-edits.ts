import type { ProfileDraft, StepDraft } from './profile-draft';

/** A new step before the last, halfway to it, for you to adjust. */
export function addStep(draft: ProfileDraft): ProfileDraft {
  const before = draft.steps.slice(0, -1);
  const last = draft.steps.at(-1);
  const previous = before.at(-1);
  if (!last) return draft;
  const fromC = Number(previous?.endC ?? draft.dryEndC);
  const toC = Number(last.endC || draft.capC);
  const step: StepDraft = {
    ...(previous ?? last),
    name: 'New step',
    endC: String(Math.round((fromC + toC) / 2)),
    backup: previous?.backup ?? last.backup,
  };
  return { ...draft, steps: [...before, step, last] };
}

/** Takes a step out; the last stays, as something has to end the roast. */
export function removeStep(draft: ProfileDraft, index: number): ProfileDraft {
  if (index >= draft.steps.length - 1) return draft;
  return { ...draft, steps: draft.steps.filter((_, i) => i !== index) };
}

export function addPoint(draft: ProfileDraft): ProfileDraft {
  const last = draft.points.at(-1);
  return { ...draft, points: [...draft.points, { time: last?.time ?? '', c: last?.c ?? '' }] };
}

export function removePoint(draft: ProfileDraft, index: number): ProfileDraft {
  return { ...draft, points: draft.points.filter((_, i) => i !== index) };
}
