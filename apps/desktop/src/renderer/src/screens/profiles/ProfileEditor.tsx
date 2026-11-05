import type { ProfileEntry } from '@roastpilot/shared';
import { Badge, NumberField, RoastChart, TextField } from '@roastpilot/ui';
import { useMemo, useState } from 'react';
import { useSettings } from '../../stores/use-stores';
import { useProfileLocked } from '../roast/use-active-profile';
import { CurvePointsTable } from './CurvePointsTable';
import { movePoint } from './draft-edits';
import { ProfileActions } from './ProfileActions';
import { isStepProfile, type ProfileDraft } from './profile-draft';
import { profilePreview } from './profile-preview';
import { StepsTable } from './StepsTable';
import { useProfileDraft } from './use-profile-draft';

const TOP_VALUES: readonly {
  key: 'chargeC' | 'dryEndC' | 'devTime' | 'capC' | 'batchG';
  label: string;
  unit?: string;
}[] = [
  { key: 'chargeC', label: 'Charge temp', unit: '°C' },
  { key: 'dryEndC', label: 'Dry end', unit: '°C' },
  { key: 'devTime', label: 'Development' },
  { key: 'capC', label: 'BT cap', unit: '°C' },
  { key: 'batchG', label: 'Batch', unit: 'g' },
];

/** One profile: its top values, a preview, its steps (docs/spec/ui.md, Profiles screen). */
export function ProfileEditor({
  entry,
  onSelect,
}: {
  entry: ProfileEntry;
  onSelect: (id: string) => void;
}) {
  const state = useProfileDraft(entry);
  const { draft, errors, valid, change, edited } = state;
  const soakS = useSettings((s) => s.settings.soakTimeS);
  const active = useSettings((s) => s.settings.autoProfile) === entry.profile.id;
  const locked = useProfileLocked();
  const readOnly = entry.builtIn;
  // While a cell has a problem the chart keeps the last profile that worked.
  const [shown, setShown] = useState(valid ?? entry.profile);
  if (valid && valid !== shown) setShown(valid);
  const preview = useMemo(() => profilePreview(shown, soakS), [shown, soakS]);
  const set = (part: Partial<ProfileDraft>) => {
    change({ ...draft, ...part });
  };
  const curveDrag =
    valid && !readOnly && !isStepProfile(entry.profile)
      ? {
          points: valid.curve.slice(1).map((p) => ({ t: p.tS, v: p.c })),
          onMove: (index: number, to: { t: number; v: number }) => {
            change(movePoint(draft, valid, index, to));
          },
        }
      : undefined;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="Name"
          className="min-w-56 flex-1"
          value={draft.name}
          disabled={readOnly}
          aria-invalid={Boolean(errors.name) || undefined}
          onChange={(name) => {
            set({ name });
          }}
        />
        <ProfileActions
          entry={entry}
          state={state}
          active={active}
          locked={locked}
          onSelect={onSelect}
        />
      </div>
      <p className="flex flex-wrap items-center gap-2 text-label text-ink-muted">
        {entry.builtIn ? <Badge tone="neutral">Built-in</Badge> : null}
        {active ? <Badge tone="air">Auto uses this</Badge> : null}
        {edited ? <Badge tone="heat">Not saved</Badge> : null}
        {entry.profile.needsCalibration ? <span>Needs calibration</span> : null}
        {readOnly ? <span>· Duplicate it to change it</span> : null}
        {active && locked ? <span>· Save waits until Drop: Auto is running this one</span> : null}
      </p>
      {errors.name ? (
        <p role="alert" className="text-label text-critical-text">
          Name: {errors.name}
        </p>
      ) : null}
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
              set({ [key]: value });
            }}
          />
        ))}
      </div>
      <StepsTable
        draft={draft}
        errors={errors}
        steps={isStepProfile(entry.profile)}
        soakS={soakS}
        readOnly={readOnly}
        onChange={change}
      />
      <RoastChart
        title="Preview"
        height={200}
        layers={preview.layers}
        markers={preview.markers}
        drag={curveDrag}
      />
      {isStepProfile(entry.profile) ? null : (
        <CurvePointsTable draft={draft} errors={errors} readOnly={readOnly} onChange={change} />
      )}
    </div>
  );
}
