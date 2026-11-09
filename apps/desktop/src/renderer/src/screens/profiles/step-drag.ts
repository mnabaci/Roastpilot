import type { Modifier, UniqueIdentifier } from '@dnd-kit/core';
import type { StepDraft } from './profile-draft';

/** The steps as last seen, each with its drag id. */
export interface StepIds {
  steps: readonly StepDraft[];
  ids: readonly string[];
}

/**
 * Drag ids that stay with their step: a moved step (the same object) keeps its id; an edited one
 * (a new object) keeps the id of its place; an added one gets `newId()`. So a row keeps its
 * fields, and its focus, while you type, and slides as itself when moved.
 */
export function keepStepIds(
  before: StepIds,
  steps: readonly StepDraft[],
  newId: () => string,
): string[] {
  const byStep = new Map(before.steps.map((step, i) => [step, before.ids[i]]));
  const taken = new Set<string>();
  const take = (id: string | undefined) => {
    if (id === undefined || taken.has(id)) return undefined;
    taken.add(id);
    return id;
  };
  // Steps that kept their object claim their ids first, so a place can't take one of them.
  const kept = steps.map((step) => take(byStep.get(step)));
  return kept.map((id, i) => id ?? take(before.ids[i]) ?? newId());
}

/** The steps you can drag, and drop on: all but the last, which ends the roast. */
export const sortableIds = (ids: readonly string[]): string[] => ids.slice(0, -1);

/** The move a drop makes, or nothing (in place, off the steps, or on the last step). */
export function dropMove(
  ids: readonly string[],
  active: UniqueIdentifier,
  over: UniqueIdentifier | undefined,
): { from: number; to: number } | undefined {
  const movable = sortableIds(ids);
  const from = movable.indexOf(String(active));
  const to = over === undefined ? -1 : movable.indexOf(String(over));
  if (from < 0 || to < 0 || from === to) return undefined;
  return { from, to };
}

/** The carried row goes up and down only, and stays inside the table. */
export const keepInTable: Modifier = ({ transform, draggingNodeRect, containerNodeRect }) => {
  if (!draggingNodeRect || !containerNodeRect) return { ...transform, x: 0 };
  const up = containerNodeRect.top - draggingNodeRect.top;
  const down = containerNodeRect.bottom - draggingNodeRect.bottom;
  return { ...transform, x: 0, y: Math.min(Math.max(transform.y, up), down) };
};

/** How the other rows slide out of the way; with reduced motion they jump instead. */
export const slideFor = (reducedMotion: boolean): { duration: number; easing: string } | null =>
  reducedMotion ? null : { duration: 150, easing: 'ease' };
