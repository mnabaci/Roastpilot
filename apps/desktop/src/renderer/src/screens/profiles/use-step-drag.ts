import {
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DndContextProps,
  type DropAnimation,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useRef, useState } from 'react';
import { useReducedMotion } from '../../lib/use-reduced-motion';
import { moveStep } from './draft-edits';
import { stepName, type ProfileDraft } from './profile-draft';
import { dropMove, keepInTable, slideFor, sortableIds } from './step-drag';
import { useStepIds } from './use-step-ids';

/** The step being carried, and its row's cell widths so the floating copy lines up. */
export interface Carried {
  index: number;
  widths: number[];
}

export interface StepDrag {
  /** Props for the DndContext around the table. */
  context: DndContextProps;
  /** One per step, kept across edits and moves: row keys and drag ids. */
  ids: readonly string[];
  /** The steps you can drag and drop on (all but the last). */
  sortable: string[];
  carried: Carried | undefined;
  /** How the other rows slide; null with reduced motion. */
  slide: ReturnType<typeof slideFor>;
  /** How the floating row settles into its place; null with reduced motion. */
  dropAnimation: DropAnimation | null;
}

/** Press and move this far before a drag starts, so a click on the handle stays a click. */
const START_AFTER_PX = 4;

const INSTRUCTIONS =
  'To pick up a step, press Space or Enter. Use the up and down arrows to move it, Space or Enter to drop it, Escape to cancel. Or press Alt with up or down to move it one place.';

/** The row a drag starts from: the handle's row. */
const rowOf = (event: Event): HTMLTableRowElement | null =>
  event.target instanceof Element ? event.target.closest('tr') : null;

/** Dragging steps between Soak and the last one (docs/spec/ui.md, Moving a step). */
export function useStepDrag(draft: ProfileDraft, onChange: (next: ProfileDraft) => void): StepDrag {
  const ids = useStepIds(draft.steps);
  const slide = slideFor(useReducedMotion());
  const [carried, setCarried] = useState<Carried>();
  // A drag starts over its own place; say so only once it has left it, after "Picked up".
  const leftHome = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: START_AFTER_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const indexOf = (id: UniqueIdentifier) => ids.indexOf(String(id));
  const nameOf = (id: UniqueIdentifier) => {
    const index = indexOf(id);
    const step = draft.steps[index];
    return step ? stepName(step, index) : 'The step';
  };
  const place = (id: UniqueIdentifier) =>
    `step ${String(indexOf(id) + 1)} of ${String(ids.length)}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, ${place(active.id)}`,
    onDragOver: ({ active, over }) => {
      if (!over || (over.id === active.id && !leftHome.current)) return undefined;
      leftHome.current = true;
      return `${nameOf(active.id)}, ${place(over.id)}`;
    },
    onDragEnd: ({ active, over }) => {
      const move = dropMove(ids, active.id, over?.id);
      return move
        ? `Moved ${nameOf(active.id)} to step ${String(move.to + 1)}`
        : `${nameOf(active.id)} stays at ${place(active.id)}`;
    },
    onDragCancel: ({ active }) => `${nameOf(active.id)} put back at ${place(active.id)}`,
  };
  const context: DndContextProps = {
    sensors,
    collisionDetection: closestCenter,
    modifiers: [keepInTable],
    accessibility: { announcements, screenReaderInstructions: { draggable: INSTRUCTIONS } },
    onDragStart: ({ active, activatorEvent }) => {
      leftHome.current = false;
      const cells = rowOf(activatorEvent)?.cells ?? [];
      setCarried({
        index: indexOf(active.id),
        widths: Array.from(cells, (cell) => cell.getBoundingClientRect().width),
      });
    },
    onDragEnd: ({ active, over }) => {
      setCarried(undefined);
      const move = dropMove(ids, active.id, over?.id);
      if (move) onChange(moveStep(draft, move.from, move.to));
    },
    onDragCancel: () => {
      setCarried(undefined);
    },
  };
  return {
    context,
    ids,
    sortable: sortableIds(ids),
    carried,
    slide,
    dropAnimation: slide,
  };
}
