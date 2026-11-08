import { milestonesFrom, profileFromMilestones } from '@roastpilot/core';
import { tempSymbol, type AutoProfile } from '@roastpilot/shared';
import { Plus } from 'lucide-react';
import { Button, formatClock, NumberField, RoastChart } from '@roastpilot/ui';
import { useMemo, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import {
  addMilestonePoint,
  fromMilestoneDraft,
  MILESTONE_ROWS,
  removeMilestonePoint,
  toMilestoneDraft,
  type MilestoneRow,
} from './milestone-draft';
import { MilestonePointRow } from './MilestonePointRow';
import { profilePreview } from './profile-preview';

const ROW_LABEL: Record<MilestoneRow, string> = {
  turningPoint: 'Turning point',
  dryEnd: 'Dry end',
  firstCrack: 'First crack',
  drop: 'Drop',
};

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
  const unit = useTemperatureUnit();
  const [draft, setDraft] = useState(() => toMilestoneDraft(milestonesFrom(base), unit));
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
  const preview = useMemo(() => profilePreview(shown ?? base), [shown, base]);
  const create = () => {
    if (!valid) return;
    setBusy(true);
    run(
      'profiles.milestones-failed',
      async () => {
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
      },
      { failed: "Couldn't create the profile · try again" },
    );
  };
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-60 flex-1 flex-col gap-1">
          <h2 className="flex min-h-control-sm items-center text-title text-ink">
            New from milestones
          </h2>
          <p className="text-label text-ink-muted">Soak and fan steps from {base.name}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={!valid || busy} onClick={create}>
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
      {/* The table first; the chart beside it when there's room, else below it. */}
      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Milestones" className="flex min-w-96 max-w-lg flex-1 flex-col gap-2">
          <div className="flex items-start gap-2">
            <span className="flex min-h-control-sm w-32 shrink-0 items-center text-body text-ink">
              Charge
            </span>
            {/* Fixed: its text in line with the time fields under it. */}
            <span className="flex min-h-control-sm flex-1 items-center text-body text-ink-muted tabular-nums">
              <span className="border border-transparent px-2.5">{formatClock(0)}</span>
            </span>
            <NumberField
              label="Charge temperature"
              hideLabel
              className="flex-1"
              unit={tempSymbol(draft.unit)}
              value={draft.chargeC}
              invalid={Boolean(errors.chargeC)}
              hint={errors.chargeC}
              onChange={(chargeC) => {
                setDraft({ ...draft, chargeC });
              }}
            />
            <div className="w-12 shrink-0" />
          </div>
          {MILESTONE_ROWS.map((row) => (
            <MilestonePointRow
              key={row}
              label={ROW_LABEL[row]}
              cell={row}
              point={draft.rows[row]}
              errors={errors}
              unit={tempSymbol(draft.unit)}
              onChange={(point) => {
                setDraft({ ...draft, rows: { ...draft.rows, [row]: point } });
              }}
            />
          ))}
          {draft.extras.map((point, index) => (
            <MilestonePointRow
              key={String(index)}
              label={`Your point ${String(index + 1)}`}
              cell={`extras.${String(index)}`}
              point={point}
              errors={errors}
              unit={tempSymbol(draft.unit)}
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
            icon={<Plus aria-hidden="true" />}
            onClick={() => {
              setDraft(addMilestonePoint(draft));
            }}
          >
            Add point
          </Button>
        </section>
        <div className="min-w-96 flex-1">
          <RoastChart
            title="Preview"
            height={200}
            layers={preview.layers}
            markers={preview.markers}
            temperatureUnit={draft.unit}
          />
        </div>
      </div>
    </div>
  );
}
