import { useId, type ComponentProps } from 'react';
import { cn } from '../lib/utils';

export interface TextAreaFieldProps extends Omit<
  ComponentProps<'textarea'>,
  'value' | 'onChange' | 'id'
> {
  /** Always shown above the field. */
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** A labelled multi-line text field that grows with its text (design system: TextAreaField). */
export function TextAreaField({ label, value, onChange, className, ...props }: TextAreaFieldProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-label text-ink-muted">
        {label}
      </label>
      <textarea
        id={id}
        rows={1}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="field-sizing-content min-h-control-sm max-h-48 w-full resize-none rounded-md border border-border bg-surface px-3.5 py-2.5 text-body text-ink placeholder:text-ink-muted hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
    </div>
  );
}
