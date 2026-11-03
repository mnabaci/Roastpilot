import { Search, X } from 'lucide-react';
import { useId, type ComponentProps } from 'react';
import { cn } from '../lib/utils';

export interface TextFieldProps extends Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'id'
> {
  /** Always shown above the field. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** `search` adds the search icon, a Clear button while there is text, and Escape to clear. */
  type?: 'text' | 'search';
}

/** A labelled single-line text input (design system: TextField). */
export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  className,
  onKeyDown,
  ...props
}: TextFieldProps) {
  const id = useId();
  const search = type === 'search';
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-label text-ink-muted">
        {label}
      </label>
      <div className="relative flex items-center">
        {search ? (
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 size-5 text-ink-muted"
          />
        ) : null}
        <input
          id={id}
          type={search ? 'search' : 'text'}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (search && event.key === 'Escape' && value !== '') {
              event.preventDefault();
              onChange('');
            }
            onKeyDown?.(event);
          }}
          className={cn(
            'h-control-sm w-full rounded-md border border-border bg-surface px-3.5 text-body text-ink placeholder:text-ink-muted hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-search-cancel-button]:hidden',
            search && 'pl-10',
            search && value !== '' && 'pr-11',
          )}
          {...props}
        />
        {search && value !== '' ? (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => {
              onChange('');
            }}
            className="absolute right-0 flex size-control-sm items-center justify-center rounded-md text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
