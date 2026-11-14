import type { Roaster } from '@roastpilot/shared';
import { Button, Dialog, SelectField } from '@roastpilot/ui';
import { useState } from 'react';

/**
 * Copy to another roaster, when there are two or more to pick from (docs/spec/ui.md, Profiles
 * screen, Header): one "⋯" item and this picker, so the menu doesn't grow with your roasters.
 */
export function CopyToRoasterDialog({
  open,
  onOpenChange,
  profileName,
  roasters,
  onCopy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileName: string;
  /** The other roasters, not the active one. */
  roasters: readonly Roaster[];
  onCopy: (roaster: Roaster) => void;
}) {
  const [pickedId, setPickedId] = useState<string>();
  const picked = roasters.find((r) => String(r.id) === pickedId) ?? roasters[0];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Copy to another roaster"
      description={`A copy of ${profileName}, as the other roaster's own`}
    >
      <SelectField
        label="Roaster"
        value={picked ? String(picked.id) : ''}
        options={roasters.map((r) => ({ value: String(r.id), label: r.name }))}
        onChange={setPickedId}
      />
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!picked}
          onClick={() => {
            if (!picked) return;
            onCopy(picked);
            onOpenChange(false);
          }}
        >
          Copy
        </Button>
      </div>
    </Dialog>
  );
}
