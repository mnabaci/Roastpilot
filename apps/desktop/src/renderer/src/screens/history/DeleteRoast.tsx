import { Button } from '@roastpilot/ui';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

/** Delete, asked once inline (no dialog): "Delete this roast? · can't be undone". */
export function DeleteRoast({ onDelete }: { onDelete: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <Button
        variant="ghost"
        size="sm"
        icon={<Trash2 aria-hidden="true" />}
        onClick={() => {
          setAsking(true);
        }}
      >
        Delete
      </Button>
    );
  return (
    <div role="group" aria-label="Delete this roast?" className="flex items-center gap-2">
      <span className="text-label text-ink-muted">Delete this roast? · can't be undone</span>
      <Button
        size="sm"
        onClick={() => {
          setAsking(false);
          onDelete();
        }}
      >
        Delete
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setAsking(false);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}
