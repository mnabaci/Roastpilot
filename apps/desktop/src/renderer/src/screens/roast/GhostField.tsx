import type { Bean, RoastSetup, RoastSummary } from '@roastpilot/shared';
import { SelectField } from '@roastpilot/ui';
import { ghostDetail, ghostLabel } from './ghost';

const NONE = 'none';

/** The roast drawn faded behind this one; None for no ghost. */
export function GhostField({
  setup,
  roasts,
  beans,
  onChange,
}: {
  setup: RoastSetup;
  roasts: readonly RoastSummary[];
  beans: readonly Bean[];
  onChange: (setup: RoastSetup) => void;
}) {
  return (
    <SelectField
      label="Ghost"
      value={setup.ghostRoastId === null ? NONE : String(setup.ghostRoastId)}
      options={[
        { value: NONE, label: 'None' },
        ...roasts.map((r) => ({
          value: String(r.id),
          label: ghostLabel(r),
          detail: ghostDetail(r, beans.find((b) => b.id === r.beanId)?.name),
        })),
      ]}
      onChange={(value) => {
        onChange({ ...setup, ghostRoastId: value === NONE ? null : Number(value) });
      }}
    />
  );
}
