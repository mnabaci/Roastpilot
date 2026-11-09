import { DndContext, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button, cn } from '@roastpilot/ui';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { addStep, removeStep } from './draft-edits';
import { stepName, type DraftErrors, type ProfileDraft, type StepDraft } from './profile-draft';
import { SoakRow } from './SoakRow';
import { SortableStep } from './SortableStep';
import { BUTTON_CELL } from './step-cells';
import { StepHandle } from './StepHandle';
import { StepOverlay } from './StepOverlay';
import { StepRow } from './StepRow';
import { StepsHead } from './StepsHead';
import { useStepDrag } from './use-step-drag';
import { useStepMoves } from './use-step-moves';

interface StepsTableProps {
  draft: ProfileDraft;
  errors: DraftErrors;
  /** A step profile has a duration and RoR range per step; a curve profile doesn't. */
  steps: boolean;
  readOnly: boolean;
  onChange: (next: ProfileDraft) => void;
  className?: string;
}

/**
 * One row per step (docs/spec/ui.md, Profiles screen), each step in a group of its own so it can
 * be dragged by its handle. The Soak row and the last step stay.
 */
export function StepsTable({
  draft,
  errors,
  steps,
  readOnly,
  onChange,
  className,
}: StepsTableProps) {
  const moves = useStepMoves(draft, onChange);
  const drag = useStepDrag(draft, onChange);
  // Step, Ends, Heat, Fan, Backup and Remove; a step profile adds Time and RoR; the handles theirs.
  const columns = (steps ? 9 : 6) + (readOnly ? 0 : 1);
  const row = (step: StepDraft, index: number, handle?: ReactNode) => (
    <StepRow
      step={step}
      index={index}
      last={index === draft.steps.length - 1}
      errors={errors}
      steps={steps}
      columns={columns}
      readOnly={readOnly}
      onChange={(change) => {
        onChange({
          ...draft,
          steps: draft.steps.map((s, i) => (i === index ? { ...s, ...change } : s)),
        });
      }}
      onRemove={() => {
        onChange(removeStep(draft, index));
      }}
      handle={handle}
    />
  );
  const carried = drag.carried && draft.steps[drag.carried.index];
  return (
    <section
      aria-labelledby="steps-heading"
      className={cn('flex min-w-0 flex-col gap-2', className)}
    >
      <h2 id="steps-heading" className="text-heading">
        Steps
      </h2>
      <DndContext {...drag.context}>
        <table className="w-full border-collapse">
          <StepsHead unit={draft.unit} steps={steps} readOnly={readOnly} />
          <tbody>
            <SoakRow
              draft={draft}
              errors={errors}
              steps={steps}
              columns={columns}
              readOnly={readOnly}
              onChange={onChange}
            />
          </tbody>
          <SortableContext items={drag.sortable} strategy={verticalListSortingStrategy}>
            {draft.steps.map((step, index) => {
              const id = drag.ids[index] ?? String(index);
              if (readOnly) return <tbody key={id}>{row(step, index)}</tbody>;
              if (index === draft.steps.length - 1) {
                return <tbody key={id}>{row(step, index, <td className={BUTTON_CELL} />)}</tbody>;
              }
              return (
                <SortableStep
                  key={id}
                  id={id}
                  index={index}
                  name={stepName(step, index)}
                  slide={drag.slide}
                  moves={moves}
                >
                  {(handle) => row(step, index, handle)}
                </SortableStep>
              );
            })}
          </SortableContext>
        </table>
        {createPortal(
          <DragOverlay
            dropAnimation={drag.dropAnimation}
            className="cursor-grabbing rounded-md bg-surface-raised shadow-(--shadow-raised)"
          >
            {drag.carried && carried ? (
              <StepOverlay widths={drag.carried.widths}>
                {row(
                  carried,
                  drag.carried.index,
                  <td className={BUTTON_CELL}>
                    <StepHandle name={stepName(carried, drag.carried.index)} tabIndex={-1} />
                  </td>,
                )}
              </StepOverlay>
            ) : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
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
