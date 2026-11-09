import { MODEL_DRUM_SPEED, type Roaster } from '@roastpilot/shared';
import { Button, NumberField, Switch, TextField } from '@roastpilot/ui';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import {
  DRUM_FIELDS,
  everydayFields,
  TUNING_FIELDS,
  tuningHint,
  type FieldGroup,
} from './roaster-fields';
import type { RoasterDraftState } from './use-roaster-draft';

/**
 * One roaster's record (docs/spec/roasters.md): read until Edit, then a form whose Cancel and Save
 * sit in the page's header.
 */
export function RoasterEditor({
  roaster,
  state,
  editing,
}: {
  roaster: Roaster;
  state: RoasterDraftState;
  editing: boolean;
}) {
  const { draft, setDraft, errors, problem, unit } = state;
  const readOnly = !editing;
  const [showTuning, setShowTuning] = useState(false);
  // A problem in a tuning number opens the section, so a held-back Save is never unexplained.
  const tuningShown =
    showTuning || TUNING_FIELDS.some((g) => g.cells.some((c) => Boolean(errors[c.key])));
  const fields = ({ title, hint, cells }: FieldGroup) => (
    <fieldset key={title} className="flex flex-col gap-2">
      <legend className="pb-1 text-body font-semibold">{title}</legend>
      {hint ? <p className="text-label text-ink-muted">{hint}</p> : null}
      <div className="grid grid-cols-3 items-start gap-3">
        {cells.map(({ key, label, unit }) => (
          <NumberField
            key={key}
            label={label}
            value={draft[key]}
            readOnly={readOnly}
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
    <div className="flex flex-col gap-5 rounded-xl bg-surface px-5 py-4.5">
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <TextField
            label="Name"
            value={draft.name}
            onChange={(name) => {
              setDraft({ ...draft, name });
            }}
          />
          {errors.name ? <p className="text-label text-critical-text">{errors.name}</p> : null}
        </div>
      ) : null}
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
          {readOnly ? (
            <p className="text-body text-ink">{draft.coolerHelpsDrum ? 'On' : 'Off'}</p>
          ) : (
            <Switch
              aria-label="Bean cooler helps cool the drum"
              checked={draft.coolerHelpsDrum}
              onChange={(on) => {
                setDraft({ ...draft, coolerHelpsDrum: on });
              }}
            />
          )}
        </div>
      </fieldset>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3.5 self-start"
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
        Advanced tuning
      </Button>
      {tuningShown ? (
        <div className="flex flex-col gap-4">
          <p className="text-label text-ink-muted">{tuningHint(unit)}</p>
          {TUNING_FIELDS.map(fields)}
        </div>
      ) : null}
    </div>
  );
}
