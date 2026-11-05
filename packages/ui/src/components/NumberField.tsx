import { useId, type ComponentProps } from 'react';
import { cn } from '../lib/utils';

export interface NumberFieldProps extends Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'id'
> {
  /** Always read by screen readers; shown above the field unless `hideLabel` (in a table). */
  label: string;
  /** The text as typed, so a half-typed value stays until it is checked. */
  value: string;
  onChange: (value: string) => void;
  /** Shown inside the field, on the right. */
  unit?: string;
  hideLabel?: boolean;
  invalid?: boolean;
  /** One line under the field; in the critical colour when invalid. */
  hint?: string | undefined;
}

/** A short numeric or m:ss input, for tables and rows of values (design system: NumberField). */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  hideLabel = false,
  invalid = false,
  hint,
  className,
  ...props
}: NumberFieldProps) {
  const id = useId();
  const hintId = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-label text-ink-muted'}>
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className={cn(
            'h-control-sm w-full rounded-md border bg-surface px-2.5 text-body text-ink tabular-nums hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50',
            invalid ? 'border-critical-text' : 'border-border',
            unit && 'pr-9',
          )}
          {...props}
        />
        {unit ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 text-label text-ink-muted"
          >
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p
          id={hintId}
          className={cn('text-label', invalid ? 'text-critical-text' : 'text-ink-muted')}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
