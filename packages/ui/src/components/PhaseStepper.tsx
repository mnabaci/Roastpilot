import { cn } from '../lib/utils';

export interface PhaseStepperProps {
  steps: readonly string[];
  /** Index of the current step. Steps before it are done. */
  current: number;
  className?: string;
}

/** Shows where the roast is: done steps, the current step and what comes next. */
export function PhaseStepper({ steps, current, className }: PhaseStepperProps) {
  return (
    <ol aria-label="Roast progress" className={cn('flex flex-wrap gap-7', className)}>
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'upcoming';
        return (
          <li
            key={step}
            aria-current={state === 'current' ? 'step' : undefined}
            className="flex items-center gap-2"
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-2.5 rounded-full',
                state === 'done' && 'bg-good',
                state === 'current' && 'bg-heat-fill',
                state === 'upcoming' && 'bg-border-strong',
              )}
            />
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
          </li>
        );
      })}
    </ol>
  );
}
