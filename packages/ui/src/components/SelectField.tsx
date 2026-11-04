import { ChevronDown } from 'lucide-react';
import { useId, type ComponentProps } from 'react';
import { cn } from '../lib/utils';

export interface SelectFieldProps<V extends string> extends Omit<
  ComponentProps<'select'>,
  'value' | 'onChange' | 'id' | 'children'
> {
  /** Always shown above the field. */
  label: string;
  value: V;
  options: readonly { value: V; label: string }[];
  onChange: (value: V) => void;
}

/** A labelled drop-down over the native select (design system: SelectField). */
export function SelectField<V extends string>({
  label,
  value,
  options,
  onChange,
  className,
  ...props
}: SelectFieldProps<V>) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-label text-ink-muted">
        {label}
      </label>
      <div className="relative flex items-center">
        <select
          id={id}
          value={value}
          onChange={(event) => {
            // Only values from `options` can be picked.
            onChange(event.target.value as V);
          }}
          className="h-control-sm w-full appearance-none truncate rounded-md border border-border bg-surface pr-10 pl-3.5 text-body text-ink hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 size-5 text-ink-muted"
        />
      </div>
    </div>
  );
}
