import type { RoastSetup, RoastSummary } from '@roastpilot/shared';
import { SelectField } from '@roastpilot/ui';
import { ghostLabel } from './ghost';

const NONE = 'none';

/** The roast drawn faded behind this one; None for no ghost. */
export function GhostField({
  setup,
  roasts,
  onChange,
}: {
  setup: RoastSetup;
  roasts: readonly RoastSummary[];
  onChange: (setup: RoastSetup) => void;
}) {
  return (
    <SelectField
      label="Ghost"
      value={setup.ghostRoastId === null ? NONE : String(setup.ghostRoastId)}
      options={[
        { value: NONE, label: 'None' },
        ...roasts.map((r) => ({ value: String(r.id), label: ghostLabel(r) })),
      ]}
      onChange={(value) => {
        onChange({ ...setup, ghostRoastId: value === NONE ? null : Number(value) });
      }}
    />
  );
}
