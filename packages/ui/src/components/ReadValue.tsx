import { useId } from 'react';
import { cn } from '../lib/utils';

export interface ReadValueProps {
  label: string;
  /** Shown as is; empty shows "–". */
  value: string;
  hideLabel?: boolean;
  /** Numbers line up in columns. */
  numeric?: boolean;
  /** One line under it, as the field's hint would be. */
  hint?: string | undefined;
  className?: string;
}

/**
 * A field's value in read mode (docs/spec/ui.md, Read and edit): its label, then the value as
 * text where the field's box would be, so Edit swaps one for the other without anything moving.
 * NumberField, TextField and SelectField show this when `readOnly`.
 */
export function ReadValue({
  label,
  value,
  hideLabel = false,
  numeric = false,
  hint,
  className,
}: ReadValueProps) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span id={id} className={hideLabel ? 'sr-only' : 'text-label text-ink-muted'}>
        {label}
      </span>
      <p
        aria-labelledby={id}
        className={cn(
          'flex h-control-sm min-w-0 items-center text-body text-ink',
          numeric && 'tabular-nums',
          // In a table the text lines up with the column's heading, as a field's would.
          hideLabel && 'px-2.5',
        )}
      >
        <span className="truncate">{value.trim() === '' ? '–' : value}</span>
      </p>
      {hint ? <p className="text-label text-ink-muted">{hint}</p> : null}
    </div>
  );
}
