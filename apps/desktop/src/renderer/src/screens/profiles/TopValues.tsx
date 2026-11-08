import { tempSymbol } from '@roastpilot/shared';
import { NumberField } from '@roastpilot/ui';
import type { DraftErrors, ProfileDraft } from './profile-draft';

type TopKey = 'chargeC' | 'dryEndC' | 'devTime' | 'capC' | 'batchG';

/** `temp`: the draft's temperature unit. `hint`: one line under the field while it has no error. */
const TOP_VALUES: readonly { key: TopKey; label: string; unit?: string; hint?: string }[] = [
  { key: 'chargeC', label: 'Charge temp', unit: 'temp' },
  { key: 'dryEndC', label: 'Dry end', unit: 'temp' },
  { key: 'devTime', label: 'Development' },
  { key: 'capC', label: 'BT cap', unit: 'temp' },
  // The batch it was tuned for: a different batch on the Roast screen runs off its plan.
  { key: 'batchG', label: 'Tuned for', unit: 'g', hint: 'Batch size' },
];

/** The profile's top values in one row: charge, dry end, development, BT cap, tuned-for batch. */
export function TopValues({
  draft,
  errors,
  readOnly,
  onChange,
}: {
  draft: ProfileDraft;
  errors: DraftErrors;
  readOnly: boolean;
  onChange: (part: Partial<ProfileDraft>) => void;
}) {
  return (
    <div className="grid grid-cols-5 items-start gap-3">
      {TOP_VALUES.map(({ key, label, unit, hint }) => (
        <NumberField
          key={key}
          label={label}
          value={draft[key]}
          disabled={readOnly}
          invalid={Boolean(errors[key])}
          hint={errors[key] ?? hint}
          {...(unit ? { unit: unit === 'temp' ? tempSymbol(draft.unit) : unit } : {})}
          onChange={(value) => {
            onChange({ [key]: value });
          }}
        />
      ))}
    </div>
  );
}
