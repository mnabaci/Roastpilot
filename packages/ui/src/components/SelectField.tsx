import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import { cn } from '../lib/utils';
import { Select, type SelectOption } from './Select';

export interface SelectFieldProps<V extends string> {
  /** Always read by screen readers; shown above the field unless `hideLabel` (in a table). */
  label: string;
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (value: V) => void;
  disabled?: boolean;
  hideLabel?: boolean;
  className?: string;
}

/** A labelled drop-down that opens the app's own panel (design system: SelectField, Select). */
export function SelectField<V extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  hideLabel = false,
  className,
}: SelectFieldProps<V>) {
  const id = useId();
  const current = options.find((o) => o.value === value)?.label ?? '';
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-label text-ink-muted'}>
        {label}
      </label>
      <Select
        id={id}
        label={label}
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        className="group flex h-control-sm w-full items-center gap-2 rounded-md border border-border bg-surface pr-3 pl-3.5 text-left text-body text-ink hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-border-strong"
      >
        <span className="min-w-0 flex-1 truncate">{current}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 text-ink-muted transition-transform group-data-[state=open]:rotate-180"
        />
      </Select>
    </div>
  );
}
