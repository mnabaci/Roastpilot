import type { ProfileEntry } from '@roastpilot/shared';
import { RoastChart } from '@roastpilot/ui';
import { useMemo, useState } from 'react';
import { useSettings } from '../../stores/use-stores';
import { useProfileLocked } from '../roast/use-active-profile';
import { CurvePointsTable } from './CurvePointsTable';
import { movePoint } from './draft-edits';
import { ProfileHeader } from './ProfileHeader';
import { isStepProfile } from './profile-draft';
import { profilePreview } from './profile-preview';
import { StepsTable } from './StepsTable';
import { TopValues } from './TopValues';
import { useProfileDraft } from './use-profile-draft';

/**
 * One profile: its top values, the preview right under them so what you shape stays in view, then
 * its steps (docs/spec/ui.md, Profiles screen, Layout).
 */
export function ProfileEditor({
  entry,
  onSelect,
}: {
  entry: ProfileEntry;
  onSelect: (id: string) => void;
}) {
  const state = useProfileDraft(entry);
  const { draft, errors, valid, change } = state;
  const active = useSettings((s) => s.settings.autoProfile) === entry.profile.id;
  const locked = useProfileLocked();
  // Opens to read; Edit makes it a form (docs/spec/ui.md, Read and edit). An unsaved edit kept
  // from before opens as the form, so it shows.
  const [editing, setEditing] = useState(state.edited && !entry.builtIn);
  const readOnly = entry.builtIn || !editing;
  const steps = isStepProfile(entry.profile);
  // While a cell has a problem the chart keeps the last profile that worked.
  const [shown, setShown] = useState(valid ?? entry.profile);
  if (valid && valid !== shown) setShown(valid);
  const preview = useMemo(() => profilePreview(shown), [shown]);
  const curveDrag =
    valid && !readOnly && !steps
      ? {
          points: valid.curve.slice(1).map((p) => ({ t: p.tS, v: p.c })),
          onMove: (index: number, to: { t: number; v: number }) => {
            change(movePoint(draft, valid, index, to));
          },
        }
      : undefined;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <ProfileHeader
        entry={entry}
        state={state}
        active={active}
        locked={locked}
        editing={!readOnly}
        onEditingChange={setEditing}
        onSelect={onSelect}
      />
      <TopValues
        draft={draft}
        errors={errors}
        readOnly={readOnly}
        onChange={(part) => {
          change({ ...draft, ...part });
        }}
      />
      <RoastChart
        title="Preview"
        height={200}
        layers={preview.layers}
        markers={preview.markers}
        drag={curveDrag}
        temperatureUnit={draft.unit}
      />
      {steps ? (
        <StepsTable draft={draft} errors={errors} steps readOnly={readOnly} onChange={change} />
      ) : (
        // Steps and curve points side by side, Steps the wider; stacked in a narrower window.
        <div className="grid items-start gap-4 xl:grid-cols-3">
          <StepsTable
            className="xl:col-span-2"
            draft={draft}
            errors={errors}
            steps={false}
            readOnly={readOnly}
            onChange={change}
          />
          <CurvePointsTable draft={draft} errors={errors} readOnly={readOnly} onChange={change} />
        </div>
      )}
    </div>
  );
}
