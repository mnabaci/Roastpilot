import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';

export interface TitleFieldProps extends Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'aria-label'
> {
  value: string;
  onChange: (value: string) => void;
  /** Its name for screen readers; the page title stands where a visible label would. */
  label?: string;
  invalid?: boolean;
}

/**
 * A page's title as a field, in Edit (design system: TitleField): rename a bean, profile or
 * roaster where its name already is, not in a Name field of its own.
 */
export function TitleField({
  value,
  onChange,
  label = 'Name',
  invalid = false,
  className,
  ...props
}: TitleFieldProps) {
  return (
    <input
      type="text"
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      className={cn(
        // Pulled out by its padding, so its text stays where the title's was.
        '-mx-2 h-control-sm w-full min-w-0 truncate rounded-md border border-border bg-surface px-2 text-title text-ink placeholder:text-ink-muted hover:border-border-strong focus-visible:outline-2 focus-visible:outline-focus',
        invalid && 'border-critical hover:border-critical',
        className,
      )}
      {...props}
    />
  );
}
