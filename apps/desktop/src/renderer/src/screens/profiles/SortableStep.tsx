import { useDndContext } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@roastpilot/ui';
import type { KeyboardEventHandler, ReactNode } from 'react';
import { BUTTON_CELL } from './step-cells';
import { StepHandle } from './StepHandle';
import type { StepMoves } from './use-step-moves';

/**
 * A step you can move: its rows as one group that slides out of the way of a carried step, and
 * becomes the faint placeholder, edged in `heat`, where the carried step will land.
 */
export function SortableStep({
  id,
  index,
  name,
  slide,
  moves,
  children,
}: {
  id: string;
  index: number;
  name: string;
  slide: { duration: number; easing: string } | null;
  moves: StepMoves;
  /** The step's rows, given the handle's cell to put first. */
  children: (handle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, transition: slide });
  const carrying = useDndContext().active !== null;
  const { onKeyDown, ...pointer } = listeners ?? {};
  // dnd-kit types its listeners loosely (Function); this one is the keyboard sensor's start key.
  const pickUp = onKeyDown as KeyboardEventHandler | undefined;
  const handle = (
    <td className={BUTTON_CELL}>
      <StepHandle
        name={name}
        ref={(button) => {
          setActivatorNodeRef(button);
          moves.handleRef(index)(button);
        }}
        {...attributes}
        {...pointer}
        onKeyDown={(event) => {
          // Alt+↑ / Alt+↓ move one place, but not while a step is being carried.
          if (!carrying && moves.onKeyDown(index, event)) return;
          pickUp?.(event);
        }}
      />
    </td>
  );
  return (
    <tbody
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(isDragging && 'relative outline-2 -outline-offset-2 outline-heat *:opacity-30')}
    >
      {children(handle)}
    </tbody>
  );
}
