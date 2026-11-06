import { Trash2 } from 'lucide-react';
import { ConfirmInline } from '../../features/ConfirmInline';

/** Delete, asked once inline: "Delete this roast? · can't be undone". */
export function DeleteRoast({ onDelete }: { onDelete: () => void }) {
  return (
    <ConfirmInline
      label="Delete"
      destructive
      icon={<Trash2 aria-hidden="true" />}
      question="Delete this roast? · can't be undone"
      confirmLabel="Delete"
      onConfirm={onDelete}
    />
  );
}
