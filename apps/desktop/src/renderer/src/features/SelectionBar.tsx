import { Button, ConfirmDialog } from '@roastpilot/ui';
import { useState, type ReactNode } from 'react';

/** What the bar's second action does to the ticked ones, and how the question names them. */
export interface SelectionRemove {
  /** The button and the dialog's confirm: `Delete`, or `Archive` for beans. */
  verb: 'Delete' | 'Archive';
  /** One and many: `['roast', 'roasts']`. */
  noun: readonly [string, string];
  /** Under the question: `can't be undone`. */
  detail: string;
  onConfirm: () => void;
}

/**
 * While selecting a list, the same bar on every screen (docs/spec/ui.md, Select): how many are
 * ticked, Export, Delete (or Archive) asked once, and Done. Export and Delete wait, dimmed, until
 * something is ticked.
 */
export function SelectionBar({
  label,
  count,
  exportAction,
  remove,
  onDone,
}: {
  /** Names the bar, e.g. "Selected roasts". */
  label: string;
  count: number;
  /** Exports the ticked ones; a node when it offers a choice (History's file or CSV). */
  exportAction: (() => void) | ReactNode;
  remove?: SelectionRemove | undefined;
  onDone: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const none = count === 0;
  return (
    // The count on its own line, the actions under it: they fit the 256px sidebar whatever they are.
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1" role="toolbar" aria-label={label}>
      <span className="basis-full text-label text-ink-muted" aria-live="polite">
        {count} selected
      </span>
      {typeof exportAction === 'function' ? (
        <Button size="sm" disabled={none} onClick={exportAction}>
          Export
        </Button>
      ) : (
        exportAction
      )}
      {remove ? (
        <>
          <Button
            size="sm"
            className={remove.verb === 'Delete' ? 'text-critical-text' : undefined}
            disabled={none}
            onClick={() => {
              setAsking(true);
            }}
          >
            {remove.verb}
          </Button>
          <ConfirmDialog
            open={asking}
            onOpenChange={setAsking}
            question={`${remove.verb} ${String(count)} ${remove.noun[count === 1 ? 0 : 1]}?`}
            detail={remove.detail}
            confirmLabel={remove.verb}
            destructive={remove.verb === 'Delete'}
            onConfirm={remove.onConfirm}
          />
        </>
      ) : null}
      <Button size="sm" variant="outline" className="ml-auto" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
