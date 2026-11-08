import { tempSymbol } from '@roastpilot/shared';
import { Plus } from 'lucide-react';
import { Button, cn } from '@roastpilot/ui';
import type { ProfileDraft, StepDraft, DraftErrors } from './profile-draft';
import { addStep, removeStep } from './draft-edits';
import { SoakRow } from './SoakRow';
import { StepRow } from './StepRow';
import { useStepMoves } from './use-step-moves';

// A header wraps ("RoR / min") only when the window is too narrow for its column on one line.
const HEAD = 'px-0.5 pb-1 text-left align-bottom text-label font-normal text-ink-muted xl:px-1';

interface StepsTableProps {
  draft: ProfileDraft;
  errors: DraftErrors;
  /** A step profile has a duration and RoR range per step; a curve profile doesn't. */
  steps: boolean;
  readOnly: boolean;
  onChange: (next: ProfileDraft) => void;
  className?: string;
}

/** One row per step (docs/spec/ui.md, Profiles screen). The Soak row and the last step stay. */
export function StepsTable({
  draft,
  errors,
  steps,
  readOnly,
  onChange,
  className,
}: StepsTableProps) {
  const moves = useStepMoves(draft, onChange);
  // Step, Ends, Heat, Fan, Backup and Remove; a step profile adds Time and RoR; the handles theirs.
  const columns = (steps ? 9 : 6) + (readOnly ? 0 : 1);
  const setStep = (index: number, change: Partial<StepDraft>) => {
    onChange({
      ...draft,
      steps: draft.steps.map((step, i) => (i === index ? { ...step, ...change } : step)),
    });
  };
  return (
    <section
      aria-labelledby="steps-heading"
      className={cn('flex min-w-0 flex-col gap-2', className)}
    >
      <h2 id="steps-heading" className="text-heading">
        Steps
      </h2>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {readOnly ? null : <th aria-label="Move" />}
            <th className={HEAD}>Step</th>
            <th className={HEAD}>Ends {tempSymbol(draft.unit)}</th>
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
              moves={readOnly ? undefined : moves}
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
      <p className="sr-only" aria-live="polite">
        {moves.said}
      </p>
    </section>
  );
}
