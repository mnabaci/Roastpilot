import type { AutoProfile } from '@roastpilot/shared';
import { formatClock } from '@roastpilot/ui';
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

/**
 * Moves point `index` (counted after charge) to whole seconds and degrees, staying between its
 * neighbours and under the BT cap, so a drag can't make the profile invalid.
 */
export function movePoint(
  draft: ProfileDraft,
  profile: Pick<AutoProfile, 'curve' | 'capC'>,
  index: number,
  to: { t: number; v: number },
): ProfileDraft {
  const minS = (profile.curve[index]?.tS ?? -1) + 1;
  const maxS = (profile.curve[index + 2]?.tS ?? Infinity) - 1;
  const tS = Math.min(Math.max(Math.round(to.t), minS), maxS);
  const c = Math.min(Math.max(Math.round(to.v), 0), profile.capC);
  return {
    ...draft,
    points: draft.points.map((point, i) =>
      i === index ? { time: formatClock(tS), c: String(c) } : point,
    ),
  };
}

export function removePoint(draft: ProfileDraft, index: number): ProfileDraft {
  return { ...draft, points: draft.points.filter((_, i) => i !== index) };
}
