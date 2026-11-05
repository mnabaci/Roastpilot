import { Button, formatClock, NumberField } from '@roastpilot/ui';
import type { ProfileDraft, StepDraft, DraftErrors } from './profile-draft';
import { addStep, removeStep } from './draft-edits';
import { StepRow } from './StepRow';

const HEAD = 'px-1 pb-1 text-left text-label font-normal text-ink-muted';
const CELL = 'px-1 py-1 align-middle';

interface StepsTableProps {
  draft: ProfileDraft;
  errors: DraftErrors;
  /** A step profile has a duration and RoR range per step; a curve profile doesn't. */
  steps: boolean;
  soakS: number;
  readOnly: boolean;
  onChange: (next: ProfileDraft) => void;
}

/** One row per step (docs/spec/ui.md, Profiles screen). Soak first and the last step are fixed. */
export function StepsTable({ draft, errors, steps, soakS, readOnly, onChange }: StepsTableProps) {
  const setStep = (index: number, change: Partial<StepDraft>) => {
    onChange({
      ...draft,
      steps: draft.steps.map((step, i) => (i === index ? { ...step, ...change } : step)),
    });
  };
  return (
    <section aria-labelledby="steps-heading" className="flex flex-col gap-2">
      <h2 id="steps-heading" className="text-heading">
        Steps
      </h2>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={HEAD}>Step</th>
            <th className={HEAD}>Ends °C</th>
            {steps ? <th className={HEAD}>Time</th> : null}
            {steps ? <th className={HEAD}>RoR min</th> : null}
            {steps ? <th className={HEAD}>RoR max</th> : null}
            <th className={HEAD}>Heat %</th>
            <th className={HEAD}>Fan %</th>
            <th className={HEAD}>Backup</th>
            <th aria-label="Remove" />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${CELL} text-body`}>Soak</td>
            <td className={`${CELL} text-body text-ink-muted`}>–</td>
            {steps ? (
              <td className={`${CELL} text-body text-ink-muted`}>{formatClock(soakS)}</td>
            ) : null}
            {steps ? <td className={CELL} /> : null}
            {steps ? <td className={CELL} /> : null}
            <td className={`${CELL} text-body text-ink-muted`}>0</td>
            <td className={CELL}>
              <NumberField
                label="Soak fan"
                hideLabel
                value={draft.soakFan}
                disabled={readOnly}
                invalid={Boolean(errors.soakFan)}
                onChange={(soakFan) => {
                  onChange({ ...draft, soakFan });
                }}
              />
            </td>
            <td className={CELL} />
            <td className={CELL} />
          </tr>
          {draft.steps.map((step, index) => (
            <StepRow
              key={String(index)}
              step={step}
              index={index}
              last={index === draft.steps.length - 1}
              errors={errors}
              steps={steps}
              columns={steps ? 9 : 6}
              readOnly={readOnly}
              onChange={(change) => {
                setStep(index, change);
              }}
              onRemove={() => {
                onChange(removeStep(draft, index));
              }}
            />
          ))}
        </tbody>
      </table>
      {readOnly ? null : (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            onChange(addStep(draft));
          }}
        >
          Add step
        </Button>
      )}
      <p className="text-label text-ink-muted">
        Soak time is in Settings · backup moves on if the temperature never comes.
      </p>
    </section>
  );
}
