import type { Roaster } from '@roastpilot/shared';
import { Button, NumberField, TextField } from '@roastpilot/ui';
import { useMemo, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { ConfirmInline } from '../../features/ConfirmInline';
import { useRun } from '../../features/use-run';
import { fromRoasterDraft, toRoasterDraft, type RoasterDraft } from './roaster-draft';

const GROUPS: readonly {
  title: string;
  cells: readonly { key: keyof RoasterDraft; label: string; unit?: string }[];
}[] = [
  {
    title: 'Batch size',
    cells: [
      { key: 'batchMinG', label: 'Min', unit: 'g' },
      { key: 'batchIdealG', label: 'Ideal', unit: 'g' },
      { key: 'batchMaxG', label: 'Max', unit: 'g' },
    ],
  },
  {
    title: 'Limits and calibration',
    cells: [
      { key: 'maxTempC', label: 'Max temp', unit: '°C' },
      { key: 'maxTimeMin', label: 'Max time', unit: 'min' },
      { key: 'tempOffsetC', label: 'Temp offset', unit: '°C' },
    ],
  },
  {
    title: 'Preheat',
    cells: [
      { key: 'hold', label: 'Hold' },
      { key: 'preheatKp', label: 'Kp' },
      { key: 'preheatKi', label: 'Ki' },
    ],
  },
  {
    title: 'Step targets',
    cells: [
      { key: 'targetKp', label: 'Kp' },
      { key: 'targetKi', label: 'Ki' },
      { key: 'targetLimitPct', label: 'Correction', unit: '%' },
    ],
  },
  {
    title: 'Curve follow',
    cells: [
      { key: 'followKp', label: 'Kp' },
      { key: 'followKi', label: 'Ki' },
    ],
  },
];

/** One roaster's record (docs/spec/roasters.md). Locked while a roaster is connected. */
export function RoasterEditor({
  roaster,
  locked,
  onDeleted,
}: {
  roaster: Roaster;
  locked: boolean;
  onDeleted: () => void;
}) {
  const { api, logger } = useDeps();
  const run = useRun();
  const saved = useMemo(() => toRoasterDraft(roaster), [roaster]);
  const [draft, setDraft] = useState(saved);
  const [problem, setProblem] = useState<string>();
  const checked = useMemo(() => fromRoasterDraft(draft, roaster), [draft, roaster]);
  const errors = checked.ok ? {} : checked.error;
  const edited = JSON.stringify(draft) !== JSON.stringify(saved);
  const save = () => {
    if (!checked.ok) return;
    run('roasters.save-failed', async () => {
      const result = await api.saveRoaster(checked.value);
      if (result.ok) {
        setProblem(undefined);
        return;
      }
      logger.warn('roasters.refused', { ...result.error });
      setProblem(
        result.error.kind === 'in-use' ? 'Disconnect first' : "Couldn't save · see the log",
      );
    });
  };
  const remove = () => {
    run('roasters.delete-failed', async () => {
      const result = await api.deleteRoaster(roaster.id);
      if (result.ok) {
        onDeleted();
        return;
      }
      logger.warn('roasters.refused', { ...result.error });
      setProblem(
        result.error.kind === 'has-roasts'
          ? 'It has saved roasts or profiles · it stays'
          : "Couldn't delete · see the log",
      );
    });
  };
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-surface px-5 py-4.5">
      <TextField
        label="Name"
        value={draft.name}
        disabled={locked}
        onChange={(name) => {
          setDraft({ ...draft, name });
        }}
      />
      {errors.name ? <p className="text-label text-critical-text">{errors.name}</p> : null}
      {GROUPS.map(({ title, cells }) => (
        <fieldset key={title} className="flex flex-col gap-2">
          <legend className="pb-1 text-body font-semibold">{title}</legend>
          <div className="grid grid-cols-3 items-start gap-3">
            {cells.map(({ key, label, unit }) => (
              <NumberField
                key={key}
                label={label}
                value={draft[key]}
                disabled={locked}
                invalid={Boolean(errors[key])}
                hint={errors[key]}
                {...(unit ? { unit } : {})}
                onChange={(value) => {
                  setDraft({ ...draft, [key]: value });
                }}
              />
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={locked || !edited || !checked.ok} onClick={save}>
          Save
        </Button>
        {edited ? (
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(saved);
            }}
          >
            Discard
          </Button>
        ) : null}
        {roaster.active || locked ? null : (
          <ConfirmInline
            label="Delete"
            question="Delete this roaster?"
            confirmLabel="Delete"
            onConfirm={remove}
          />
        )}
      </div>
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
