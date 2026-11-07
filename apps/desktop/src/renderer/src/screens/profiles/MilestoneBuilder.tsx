import { milestonesFrom, profileFromMilestones } from '@roastpilot/core';
import type { AutoProfile } from '@roastpilot/shared';
import { Button, formatClock, NumberField, RoastChart } from '@roastpilot/ui';
import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useSettings } from '../../stores/use-stores';
import {
  addMilestonePoint,
  fromMilestoneDraft,
  MILESTONE_ROWS,
  removeMilestonePoint,
  toMilestoneDraft,
  type MilestoneRow,
} from './milestone-draft';
import type { DraftErrors, PointDraft } from './profile-draft';
import { profilePreview } from './profile-preview';

const ROW_LABEL: Record<MilestoneRow, string> = {
  turningPoint: 'Turning point',
  dryEnd: 'Dry end',
  firstCrack: 'First crack',
  drop: 'Drop',
};

/** One row of the table: a name, then its time and temperature cells. */
function PointRow({
  label,
  cell,
  point,
  errors,
  onChange,
  onRemove,
}: {
  label: string;
  cell: string;
  point: PointDraft;
  errors: DraftErrors;
  onChange: (next: PointDraft) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-32 shrink-0 pt-2 text-body text-ink">{label}</span>
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
        unit="°C"
        value={point.c}
        invalid={Boolean(errors[`${cell}.c`])}
        hint={errors[`${cell}.c`]}
        onChange={(c) => {
          onChange({ ...point, c });
        }}
      />
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
  );
}

/**
 * A new curve profile from a few milestones, with the soak and fan steps of `base`
 * (docs/spec/roast-control.md and ui.md, Milestone builder).
 */
export function MilestoneBuilder({
  base,
  onCreated,
  onCancel,
}: {
  base: AutoProfile;
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const { api, stores, logger } = useDeps();
  const run = useRun();
  const soakS = useSettings((s) => s.settings.soakTimeS);
  const [draft, setDraft] = useState(() => toMilestoneDraft(milestonesFrom(base)));
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const read = useMemo(() => fromMilestoneDraft(draft), [draft]);
  const errors = read.ok ? {} : read.error;
  const valid = read.ok ? read.value : undefined;
  const latest = useMemo(
    () =>
      valid
        ? profileFromMilestones({ milestones: valid, base, id: 'preview', name: 'Preview' })
        : undefined,
    [valid, base],
  );
  // While a cell has a problem the chart keeps the last curve that worked.
  const [shown, setShown] = useState<AutoProfile | undefined>(latest);
  if (latest && latest !== shown) setShown(latest);
  const preview = useMemo(() => profilePreview(shown ?? base, soakS), [shown, base, soakS]);
  const create = () => {
    if (!valid) return;
    setBusy(true);
    run('profiles.milestones-failed', async () => {
      try {
        const saved = await api.makeProfileFromMilestones(valid);
        if (!saved.ok) {
          logger.warn('profiles.refused', { ...saved.error });
          setProblem("Couldn't save that · see the log");
          return;
        }
        stores.auto.setState({ profiles: await api.listProfiles() });
        onCreated(saved.value.profile.id);
      } finally {
        setBusy(false);
      }
    });
  };
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-60 flex-1 flex-col gap-1">
          <h2 className="text-title text-ink">New from milestones</h2>
          <p className="text-label text-ink-muted">Soak and fan steps from {base.name}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!valid || busy} onClick={create}>
              Create
            </Button>
          </div>
          {problem ? (
            <p role="alert" className="text-label text-critical-text">
              {problem}
            </p>
          ) : null}
        </div>
      </header>
      <RoastChart title="Preview" height={200} layers={preview.layers} markers={preview.markers} />
      <section aria-label="Milestones" className="flex max-w-lg flex-col gap-2">
        <div className="flex items-start gap-2">
          <span className="w-32 shrink-0 pt-2 text-body text-ink">Charge</span>
          <span className="flex-1 pt-2 text-body text-ink-muted tabular-nums">
            {formatClock(0)}
          </span>
          <NumberField
            label="Charge temperature"
            hideLabel
            className="flex-1"
            unit="°C"
            value={draft.chargeC}
            invalid={Boolean(errors.chargeC)}
            hint={errors.chargeC}
            onChange={(chargeC) => {
              setDraft({ ...draft, chargeC });
            }}
          />
        </div>
        {MILESTONE_ROWS.map((row) => (
          <PointRow
            key={row}
            label={ROW_LABEL[row]}
            cell={row}
            point={draft.rows[row]}
            errors={errors}
            onChange={(point) => {
              setDraft({ ...draft, rows: { ...draft.rows, [row]: point } });
            }}
          />
        ))}
        {draft.extras.map((point, index) => (
          <PointRow
            key={String(index)}
            label={`Your point ${String(index + 1)}`}
            cell={`extras.${String(index)}`}
            point={point}
            errors={errors}
            onChange={(next) => {
              setDraft({
                ...draft,
                extras: draft.extras.map((p, i) => (i === index ? next : p)),
              });
            }}
            onRemove={() => {
              setDraft(removeMilestonePoint(draft, index));
            }}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            setDraft(addMilestonePoint(draft));
          }}
        >
          Add point
        </Button>
      </section>
    </div>
  );
}
