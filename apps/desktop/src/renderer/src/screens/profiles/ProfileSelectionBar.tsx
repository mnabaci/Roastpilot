import { Button, ConfirmDialog } from '@roastpilot/ui';
import { useState } from 'react';
import { SelectionBar } from '../../features/SelectionBar';

/** While selecting profiles: how many, Export, Delete (asked once) and Done. */
export function ProfileSelectionBar({
  count,
  onExport,
  onDelete,
  onDone,
}: {
  count: number;
  onExport: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const none = count === 0;
  return (
    <SelectionBar label="Selected profiles" count={count} onDone={onDone}>
      <Button size="sm" disabled={none} onClick={onExport}>
        Export
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-critical-text"
        disabled={none}
        onClick={() => {
          setAsking(true);
        }}
      >
        Delete
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        question={`Delete ${String(count)} ${count === 1 ? 'profile' : 'profiles'}?`}
        detail="saved roasts keep their copy"
        confirmLabel="Delete"
        destructive
        onConfirm={onDelete}
      />
    </SelectionBar>
  );
}
