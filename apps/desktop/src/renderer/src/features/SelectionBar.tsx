import { Button } from '@roastpilot/ui';
import type { ReactNode } from 'react';

/** While selecting a list: how many are ticked, what can be done with them, and Done. */
export function SelectionBar({
  label,
  count,
  children,
  onDone,
}: {
  /** Names the bar, e.g. "Selected roasts". */
  label: string;
  count: number;
  /** The actions on the ticked ones. */
  children: ReactNode;
  onDone: () => void;
}) {
  return (
    <div className="flex items-center gap-2" role="toolbar" aria-label={label}>
      <span className="mr-auto text-label text-ink-muted" aria-live="polite">
        {count} selected
      </span>
      {children}
      <Button size="sm" variant="outline" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
