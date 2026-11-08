import { Button } from '@roastpilot/ui';
import { GripVertical } from 'lucide-react';
import type { StepMoves } from './use-step-moves';

/** The ⠿ handle that moves a step: drag it, or focus it and press Alt+↑ / Alt+↓. */
export function StepHandle({
  name,
  index,
  moves,
}: {
  name: string;
  index: number;
  moves: StepMoves;
}) {
  return (
    <Button
      ref={moves.handleRef(index)}
      variant="ghost"
      size="sm"
      draggable
      aria-label={`Move ${name}`}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      title="Drag, or Alt+↑ / Alt+↓"
      className="cursor-grab px-0 text-ink-muted active:cursor-grabbing"
      icon={<GripVertical aria-hidden="true" />}
      {...moves.handle(index)}
    />
  );
}
