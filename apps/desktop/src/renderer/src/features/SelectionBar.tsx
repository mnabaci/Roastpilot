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
    // The count on its own line, the actions under it: they fit the 256px sidebar whatever they are.
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1" role="toolbar" aria-label={label}>
      <span className="basis-full text-label text-ink-muted" aria-live="polite">
        {count} selected
      </span>
      {children}
      <Button size="sm" variant="outline" className="ml-auto" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
