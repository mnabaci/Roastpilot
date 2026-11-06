import type { Roaster } from '@roastpilot/shared';
import { Button, NumberField, TextField } from '@roastpilot/ui';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { ConfirmInline } from '../../features/ConfirmInline';
import { useRun } from '../../features/use-run';
import { fromRoasterDraft, toRoasterDraft } from './roaster-draft';
import { EVERYDAY_FIELDS, TUNING_FIELDS, TUNING_HINT, type FieldGroup } from './roaster-fields';

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
  const [showTuning, setShowTuning] = useState(false);
  // A problem in a tuning number opens the section, so a held-back Save is never unexplained.
  const tuningShown =
    showTuning || TUNING_FIELDS.some((g) => g.cells.some((c) => Boolean(errors[c.key])));
  const fields = ({ title, cells }: FieldGroup) => (
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
  );
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
      {EVERYDAY_FIELDS.map(fields)}
      <Button
        variant="ghost"
        className="self-start"
        aria-expanded={tuningShown}
        icon={
          <ChevronDown
            aria-hidden="true"
            className={tuningShown ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
        }
        onClick={() => {
          setShowTuning(!showTuning);
        }}
      >
        Advanced tuning · for experts
      </Button>
      {tuningShown ? (
        <div className="flex flex-col gap-4">
          <p className="text-label text-ink-muted">{TUNING_HINT}</p>
          {TUNING_FIELDS.map(fields)}
        </div>
      ) : null}
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
