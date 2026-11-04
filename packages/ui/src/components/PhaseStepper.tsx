import { cn } from '../lib/utils';

export interface PhaseStepperProps {
  steps: readonly string[];
  /** Index of the current step. Steps before it are done. */
  current: number;
  /** A short line under each step, e.g. how long a finished stage took ("4:10"). */
  details?: readonly (string | undefined)[];
  className?: string;
}

/** Shows where the roast is: done steps, the current step and what comes next. */
export function PhaseStepper({ steps, current, details = [], className }: PhaseStepperProps) {
  return (
    <ol aria-label="Roast progress" className={cn('flex flex-wrap gap-7', className)}>
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'upcoming';
        const detail = details[index];
        return (
          <li
            key={step}
            aria-current={state === 'current' ? 'step' : undefined}
            className="flex items-start gap-2"
          >
            <span
              aria-hidden="true"
              className={cn(
                'mt-2 size-2.5 shrink-0 rounded-full',
                state === 'done' && 'bg-good',
                state === 'current' && 'bg-heat-fill',
                state === 'upcoming' && 'bg-border-strong',
              )}
            />
            <span className="flex flex-col">
              <span
                className={cn(
                  'text-body',
                  state === 'upcoming' ? 'text-ink-muted' : 'text-ink',
                  state === 'current' && 'font-semibold',
                )}
              >
                {step}
                {state === 'done' ? <span className="sr-only"> (done)</span> : null}
              </span>
              {detail ? (
                <span className="text-label text-ink-muted tabular-nums">{detail}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
