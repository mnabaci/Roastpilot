import { Plus } from 'lucide-react';
import { Button } from '@roastpilot/ui';
import type { ProfileDraft, StepDraft, DraftErrors } from './profile-draft';
import { addStep, removeStep } from './draft-edits';
import { SoakRow } from './SoakRow';
import { StepRow } from './StepRow';

const HEAD = 'px-1 pb-1 text-left text-label font-normal whitespace-nowrap text-ink-muted';

interface StepsTableProps {
  draft: ProfileDraft;
  errors: DraftErrors;
  /** A step profile has a duration and RoR range per step; a curve profile doesn't. */
  steps: boolean;
  readOnly: boolean;
  onChange: (next: ProfileDraft) => void;
}

/** One row per step (docs/spec/ui.md, Profiles screen). The Soak row and the last step stay. */
export function StepsTable({ draft, errors, steps, readOnly, onChange }: StepsTableProps) {
  const columns = steps ? 9 : 6;
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
          <SoakRow
            draft={draft}
            errors={errors}
            steps={steps}
            columns={columns}
            readOnly={readOnly}
            onChange={onChange}
          />
          {draft.steps.map((step, index) => (
            <StepRow
              key={String(index)}
              step={step}
              index={index}
              last={index === draft.steps.length - 1}
              errors={errors}
              steps={steps}
              columns={columns}
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
          icon={<Plus aria-hidden="true" />}
          onClick={() => {
            onChange(addStep(draft));
          }}
        >
          Add step
        </Button>
      )}
      <p className="text-label text-ink-muted">Backup moves on if the temperature never comes.</p>
    </section>
  );
}
