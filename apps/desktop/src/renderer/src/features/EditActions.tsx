import { Button } from '@roastpilot/ui';

/**
 * Cancel and Save in an edit page's header, at its right end, on every screen (docs/spec/ui.md,
 * Read and edit): the quiet choice first, then the one action. Save waits until it can save.
 */
export function EditActions({
  onCancel,
  onSave,
  saveLabel = 'Save',
  canSave,
}: {
  onCancel: () => void;
  onSave: () => void;
  /** `Add bean` for a new one. */
  saveLabel?: string;
  canSave: boolean;
}) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <Button size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" variant="primary" disabled={!canSave} onClick={onSave}>
        {saveLabel}
      </Button>
    </div>
  );
}
