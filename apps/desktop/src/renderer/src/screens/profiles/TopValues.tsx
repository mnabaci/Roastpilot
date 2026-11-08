import { NumberField } from '@roastpilot/ui';
import type { DraftErrors, ProfileDraft } from './profile-draft';

type TopKey = 'chargeC' | 'dryEndC' | 'devTime' | 'capC' | 'batchG';

const TOP_VALUES: readonly { key: TopKey; label: string; unit?: string }[] = [
  { key: 'chargeC', label: 'Charge temp', unit: '°C' },
  { key: 'dryEndC', label: 'Dry end', unit: '°C' },
  { key: 'devTime', label: 'Development' },
  { key: 'capC', label: 'BT cap', unit: '°C' },
  { key: 'batchG', label: 'Batch', unit: 'g' },
];

/** The profile's top values in one row: charge, dry end, development, BT cap, batch. */
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
      {TOP_VALUES.map(({ key, label, unit }) => (
        <NumberField
          key={key}
          label={label}
          value={draft[key]}
          disabled={readOnly}
          invalid={Boolean(errors[key])}
          hint={errors[key]}
          {...(unit ? { unit } : {})}
          onChange={(value) => {
            onChange({ [key]: value });
          }}
        />
      ))}
    </div>
  );
}
