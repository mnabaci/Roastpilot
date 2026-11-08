import { Button, NumberField } from '@roastpilot/ui';
import { X } from 'lucide-react';
import type { DraftErrors, PointDraft } from './profile-draft';

/** One row of the table: a name, then its time and temperature cells. */
export function MilestonePointRow({
  label,
  cell,
  point,
  errors,
  unit,
  onChange,
  onRemove,
}: {
  label: string;
  cell: string;
  point: PointDraft;
  errors: DraftErrors;
  /** What the temperature is typed in: `°C` or `°F`. */
  unit: string;
  onChange: (next: PointDraft) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex min-h-control-sm w-32 shrink-0 items-center text-body text-ink">
        {label}
      </span>
      <NumberField
        label={`${label} time`}
        hideLabel
        className="flex-1"
        value={point.time}
        invalid={Boolean(errors[`${cell}.time`])}
        hint={errors[`${cell}.time`]}
        onChange={(time) => {
          onChange({ ...point, time });
        }}
      />
      <NumberField
        label={`${label} temperature`}
        hideLabel
        className="flex-1"
        unit={unit}
        value={point.c}
        invalid={Boolean(errors[`${cell}.c`])}
        hint={errors[`${cell}.c`]}
        onChange={(c) => {
          onChange({ ...point, c });
        }}
      />
      {/* Every row keeps the remove button's width, so the columns line up. */}
      <div className="flex w-12 shrink-0 justify-center">
        {onRemove ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove ${label.toLowerCase()}`}
            icon={<X aria-hidden="true" />}
            onClick={onRemove}
          />
        ) : null}
      </div>
    </div>
  );
}
