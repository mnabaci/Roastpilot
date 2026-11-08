import { MODEL_DRUM_SPEED, type Roaster } from '@roastpilot/shared';
import { Button, NumberField, Switch, TextField } from '@roastpilot/ui';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { fromRoasterDraft, toRoasterDraft } from './roaster-draft';
import { refusalText } from './roaster-refusal';
import {
  DRUM_FIELDS,
  everydayFields,
  TUNING_FIELDS,
  tuningHint,
  type FieldGroup,
} from './roaster-fields';

/** One roaster's record (docs/spec/roasters.md). Locked while a roaster is connected. */
export function RoasterEditor({ roaster, locked }: { roaster: Roaster; locked: boolean }) {
  const { api, logger } = useDeps();
  const run = useRun();
  const unit = useTemperatureUnit();
  const saved = useMemo(() => toRoasterDraft(roaster, unit), [roaster, unit]);
  const [draft, setDraft] = useState(saved);
  const [problem, setProblem] = useState<string>();
  const checked = useMemo(() => fromRoasterDraft(draft, roaster, unit), [draft, roaster, unit]);
  const errors = checked.ok ? {} : checked.error;
  const edited = JSON.stringify(draft) !== JSON.stringify(saved);
  const save = () => {
    if (!checked.ok) return;
    run(
      'roasters.save-failed',
      async () => {
        const result = await api.saveRoaster(checked.value);
        if (result.ok) {
          setProblem(undefined);
          return;
        }
        logger.warn('roasters.refused', { ...result.error });
        setProblem(refusalText(result.error, 'save'));
      },
      { failed: "Couldn't save the roaster · try again" },
    );
  };
  const [showTuning, setShowTuning] = useState(false);
  // A problem in a tuning number opens the section, so a held-back Save is never unexplained.
  const tuningShown =
    showTuning || TUNING_FIELDS.some((g) => g.cells.some((c) => Boolean(errors[c.key])));
  const fields = ({ title, hint, cells }: FieldGroup) => (
    <fieldset key={title} className="flex flex-col gap-2">
      <legend className="pb-1 text-body font-semibold">{title}</legend>
      {hint ? <p className="-mt-2 text-label text-ink-muted">{hint}</p> : null}
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
      {everydayFields(unit).map(fields)}
      {MODEL_DRUM_SPEED[roaster.model] ? fields(DRUM_FIELDS) : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1 text-body font-semibold">Cooling</legend>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-body">Bean cooler helps cool the drum</p>
            <p className="text-label text-ink-muted">
              Tray fan under the drum · stays on while the drum cools
            </p>
          </div>
          <Switch
            aria-label="Bean cooler helps cool the drum"
            checked={draft.coolerHelpsDrum}
            disabled={locked}
            onChange={(on) => {
              setDraft({ ...draft, coolerHelpsDrum: on });
            }}
          />
        </div>
      </fieldset>
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
          <p className="text-label text-ink-muted">{tuningHint(unit)}</p>
          {TUNING_FIELDS.map(fields)}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
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
        <Button variant="primary" disabled={locked || !edited || !checked.ok} onClick={save}>
          Save
        </Button>
      </div>
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
