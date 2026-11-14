import { useState } from 'react';
import { useSaveSettings } from '../screens/settings/use-save-settings';
import { useSettings } from '../stores/use-stores';

/**
 * Which of a record page's folding cards are open (docs/spec/ui.md, Read and edit): read, your
 * choice, saved as `openCards` for every record of its kind; Edit opens `forEdit` too, for that
 * edit only, so the fields you'd type in show without changing what you keep open.
 */
export function useRecordCards(editing: boolean, forEdit: readonly string[]) {
  const saved = useSettings((s) => s.settings.openCards);
  const saveSettings = useSaveSettings();
  const [editOpen, setEditOpen] = useState<readonly string[]>([]);
  const [wasEditing, setWasEditing] = useState(false);
  if (editing !== wasEditing) {
    setWasEditing(editing);
    if (editing) setEditOpen([...new Set([...saved, ...forEdit])]);
  }
  const open = editing ? editOpen : saved;
  return {
    /** `forced` keeps a card with a problem open, so a held-back Save is never unexplained. */
    isOpen: (card: string, forced = false): boolean => forced || open.includes(card),
    setOpen: (card: string, isOpen: boolean): void => {
      const next = [...open.filter((c) => c !== card), ...(isOpen ? [card] : [])];
      if (editing) setEditOpen(next);
      else saveSettings({ openCards: next });
    },
  };
}
