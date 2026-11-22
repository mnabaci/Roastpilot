import { useId, type ReactNode } from 'react';
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
  /** Beside the label, an InfoButton saying more about the value (a bean's roast notes). */
  info?: ReactNode;
  className?: string;
}

/**
 * A field's value in read mode (docs/spec/ui.md, Read and edit): its label, then the value as
 * text, compact, so a card of values reads at a glance; in a table (`hideLabel`) it keeps a
 * field's height, so rows line up with Edit's. NumberField, TextField and SelectField show this
 * when `readOnly`.
 */
export function ReadValue({
  label,
  value,
  hideLabel = false,
  numeric = false,
  hint,
  info,
  className,
}: ReadValueProps) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col', hideLabel ? 'gap-1.5' : 'gap-0.5', className)}>
      <span className="flex min-w-0 items-center gap-1">
        <span id={id} className={hideLabel ? 'sr-only' : 'truncate text-label text-ink-muted'}>
          {label}
        </span>
        {/* Its 24 px button doesn't make the label's line taller: tiles stay lined up. */}
        {info && !hideLabel ? <span className="-my-1 flex shrink-0">{info}</span> : null}
      </span>
      <p
        aria-labelledby={id}
        className={cn(
          'flex min-w-0 items-center text-body text-ink',
          hideLabel ? 'h-control-sm' : 'min-h-6',
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
