import { ChevronDown } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { ReadValue } from './ReadValue';
import { Select, type SelectCreate, type SelectOption } from './Select';

export interface SelectFieldProps<V extends string> {
  /** Always read by screen readers; shown above the field unless `hideLabel` (in a table). */
  label: string;
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (value: V) => void;
  disabled?: boolean;
  hideLabel?: boolean;
  /** Numbers (times, temperatures) among NumberFields: tabular, the text lined up with theirs. */
  numeric?: boolean;
  /** One line under the field, like the other fields' hints ("First batch"). */
  hint?: string | undefined;
  className?: string;
  /** Read mode: the chosen option's name as text, "–" for an empty value (ReadValue). */
  readOnly?: boolean;
  /** A list you add to as you pick: a last "Add …" row for what you typed (Select). */
  create?: SelectCreate | undefined;
  /** Beside the label, an InfoButton saying more about the value (a bean's roast notes). */
  info?: ReactNode;
}

/** A labelled drop-down that opens the app's own panel (design system: SelectField, Select). */
export function SelectField<V extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  hideLabel = false,
  numeric = false,
  hint,
  className,
  readOnly = false,
  create,
  info,
}: SelectFieldProps<V>) {
  const id = useId();
  const current = options.find((o) => o.value === value);
  if (readOnly) {
    return (
      <ReadValue
        label={label}
        value={value === '' ? '' : (current?.label ?? '')}
        hideLabel={hideLabel}
        numeric={numeric}
        hint={hint}
        info={info}
        className={className}
      />
    );
  }
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="flex min-w-0 items-center gap-1">
        <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-label text-ink-muted'}>
          {label}
        </label>
        {info && !hideLabel ? <span className="-my-1 flex shrink-0">{info}</span> : null}
      </span>
      <Select
        id={id}
        label={label}
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        {...(create ? { create } : {})}
        className={cn(
          'group flex h-control-sm w-full items-center rounded-md border border-border bg-surface text-left text-body text-ink hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-border-strong',
          numeric ? 'gap-1 pr-2 pl-2.5 tabular-nums' : 'gap-2 pr-3 pl-3.5',
        )}
      >
        {/* Only the name: a badge here would squeeze it in a narrow field; the list shows it. */}
        <span className="min-w-0 flex-1 truncate">{current?.label ?? ''}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 text-ink-muted transition-transform group-data-[state=open]:rotate-180"
        />
      </Select>
      {hint ? <p className="text-label text-ink-muted">{hint}</p> : null}
    </div>
  );
}
