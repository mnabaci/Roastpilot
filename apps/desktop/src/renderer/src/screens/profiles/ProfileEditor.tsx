import { tempSymbol, type ProfileEntry } from '@roastpilot/shared';
import { cn, CollapsibleCard, RoastChart } from '@roastpilot/ui';
import { useMemo, useState, type ReactNode } from 'react';
import { useRecordCards } from '../../features/use-record-cards';
import { PAGE_WIDTH } from '../../lib/page-width';
import { useSettings } from '../../stores/use-stores';
import { useProfileLocked } from '../roast/use-active-profile';
import { CurvePointsTable } from './CurvePointsTable';
import { movePoint } from './draft-edits';
import { ProfileHeader } from './ProfileHeader';
import { isStepProfile, stepName, type DraftErrors, type ProfileDraft } from './profile-draft';
import { profilePreview } from './profile-preview';
import { StepsTable } from './StepsTable';
import { TopValues } from './TopValues';
import { useProfileDraft } from './use-profile-draft';

/** "180 °C charge · 150 °C dry end · 1:45 development · 200 °C cap · 150 g". */
function targetsSummary(draft: ProfileDraft): string {
  const t = ` ${tempSymbol(draft.unit)}`;
  return [
    draft.chargeC.trim() && `${draft.chargeC.trim()}${t} charge`,
    draft.dryEndC.trim() && `${draft.dryEndC.trim()}${t} dry end`,
    draft.devTime.trim() && `${draft.devTime.trim()} development`,
    draft.capC.trim() && `${draft.capC.trim()}${t} cap`,
    draft.batchG.trim() && `${draft.batchG.trim()} g`,
  ]
    .filter(Boolean)
    .join(' · ');
}

const hasError = (errors: DraftErrors, keys: (key: string) => boolean): boolean =>
  Object.keys(errors).some(keys);

const TARGET_KEYS = new Set(['chargeC', 'dryEndC', 'devTime', 'capC', 'batchG']);

/**
 * One profile, as every record page (docs/spec/ui.md, Read and edit, Profiles screen): its header,
 * then its parts as cards: Targets, the preview right under them so what you shape stays in view,
 * then its steps (and curve points). Edit works in place; which cards are open is a setting.
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
  const cards = useRecordCards(!readOnly, ['profile.values', 'profile.steps', 'profile.curve']);
  const card = (key: string, title: string, summary: string, problem: boolean, body: ReactNode) => (
    <CollapsibleCard
      title={title}
      summary={summary}
      open={cards.isOpen(key, problem)}
      onOpenChange={(open) => {
        cards.setOpen(key, open);
      }}
    >
      {body}
    </CollapsibleCard>
  );
  const stepsCard = card(
    'profile.steps',
    'Steps',
    draft.steps.map((step, i) => stepName(step, i)).join(' · '),
    hasError(errors, (k) => k.startsWith('steps.') || k.startsWith('soak')),
    <StepsTable
      draft={draft}
      errors={errors}
      steps={steps}
      readOnly={readOnly}
      onChange={change}
    />,
  );
  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-4', PAGE_WIDTH)}>
      <ProfileHeader
        entry={entry}
        state={state}
        active={active}
        locked={locked}
        editing={!readOnly}
        onEditingChange={setEditing}
        onSelect={onSelect}
      />
      {card(
        'profile.values',
        'Targets',
        targetsSummary(draft),
        hasError(errors, (k) => TARGET_KEYS.has(k)),
        <TopValues
          draft={draft}
          errors={errors}
          readOnly={readOnly}
          onChange={(part) => {
            change({ ...draft, ...part });
          }}
        />,
      )}
      <RoastChart
        title="Preview"
        height={200}
        layers={preview.layers}
        markers={preview.markers}
        drag={curveDrag}
        temperatureUnit={draft.unit}
      />
      {steps ? (
        stepsCard
      ) : (
        // Steps and curve points side by side, Steps the wider; stacked in a narrower window.
        <div className="grid items-start gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">{stepsCard}</div>
          {card(
            'profile.curve',
            'Curve points',
            `${String(draft.points.length)} points`,
            hasError(errors, (k) => k.startsWith('points.')),
            <CurvePointsTable
              draft={draft}
              errors={errors}
              readOnly={readOnly}
              onChange={change}
            />,
          )}
        </div>
      )}
    </div>
  );
}
