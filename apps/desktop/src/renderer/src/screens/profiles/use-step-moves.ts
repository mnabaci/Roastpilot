import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { movable, moveStep } from './draft-edits';
import { stepName, type ProfileDraft } from './profile-draft';

/** What a step's handle and row need to move it: by drag, or Alt+↑ / Alt+↓ on the handle. */
export interface StepMoves {
  /** Keeps the handle so focus can follow its step after a keyboard move. */
  handleRef: (index: number) => (button: HTMLButtonElement | null) => void;
  handle: (index: number) => {
    onKeyDown: (event: KeyboardEvent) => void;
    onDragStart: (event: DragEvent) => void;
    onDragEnd: () => void;
  };
  row: (index: number) => {
    onDragOver: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
  };
  /** The step being dragged. */
  dragging: number | undefined;
  /** The last move, in words, for a polite live region. */
  said: string;
}

const STEP_KEYS: Readonly<Record<string, number>> = { ArrowUp: -1, ArrowDown: 1 };

/** Moving the steps between Soak and the last one (docs/spec/ui.md, Moving a step). */
export function useStepMoves(
  draft: ProfileDraft,
  onChange: (next: ProfileDraft) => void,
): StepMoves {
  const handles = useRef<(HTMLButtonElement | null)[]>([]);
  const focusOn = useRef<number>(undefined);
  const [dragging, setDragging] = useState<number>();
  const [said, setSaid] = useState('');
  // After a move re-renders the rows, focus goes to the moved step's handle in its new place.
  useEffect(() => {
    if (focusOn.current === undefined) return;
    handles.current[focusOn.current]?.focus();
    focusOn.current = undefined;
  });
  const move = (from: number, to: number) => {
    const next = moveStep(draft, from, to);
    const step = draft.steps[from];
    if (next === draft || !step) return;
    onChange(next);
    focusOn.current = to;
    setSaid(`Moved ${stepName(step, from)} to step ${String(to + 1)}`);
  };
  return {
    handleRef: (index) => (button) => {
      handles.current[index] = button;
    },
    handle: (index) => ({
      onKeyDown: (event) => {
        const by = STEP_KEYS[event.key];
        if (!event.altKey || by === undefined) return;
        event.preventDefault();
        move(index, index + by);
      },
      onDragStart: (event) => {
        const step = draft.steps[index];
        if (!step) return;
        event.dataTransfer.effectAllowed = 'move';
        // Some engines only start a drag that carries data.
        event.dataTransfer.setData('text/plain', stepName(step, index));
        setDragging(index);
      },
      onDragEnd: () => {
        setDragging(undefined);
      },
    }),
    row: (index) => ({
      onDragOver: (event) => {
        if (dragging === undefined || !movable(draft, index)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      },
      onDrop: (event) => {
        if (dragging === undefined || !movable(draft, index)) return;
        event.preventDefault();
        move(dragging, index);
        setDragging(undefined);
      },
    }),
    dragging,
    said,
  };
}
