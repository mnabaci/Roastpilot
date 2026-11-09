import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { moveStep } from './draft-edits';
import { stepName, type ProfileDraft } from './profile-draft';

/** What a step's handle needs to move it one place with Alt+↑ / Alt+↓. */
export interface StepMoves {
  /** Keeps the handle so focus can follow its step after a move. */
  handleRef: (index: number) => (button: HTMLButtonElement | null) => void;
  /** Handles Alt+↑ / Alt+↓; says whether it did, so other keys can go on to the drag. */
  onKeyDown: (index: number, event: KeyboardEvent) => boolean;
  /** The last move, in words, for a polite live region. */
  said: string;
}

const STEP_KEYS: Readonly<Record<string, number>> = { ArrowUp: -1, ArrowDown: 1 };

/** Moving a step one place from the keyboard (docs/spec/ui.md, Moving a step). */
export function useStepMoves(
  draft: ProfileDraft,
  onChange: (next: ProfileDraft) => void,
): StepMoves {
  const handles = useRef<(HTMLButtonElement | null)[]>([]);
  const focusOn = useRef<number>(undefined);
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
    onKeyDown: (index, event) => {
      const by = STEP_KEYS[event.key];
      if (!event.altKey || by === undefined) return false;
      event.preventDefault();
      move(index, index + by);
      return true;
    },
    said,
  };
}
