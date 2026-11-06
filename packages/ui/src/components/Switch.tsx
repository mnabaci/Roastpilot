import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';

export interface SwitchProps extends Omit<ComponentProps<'button'>, 'onChange' | 'role'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Names the switch for screen readers, usually the setting's name. */
  'aria-label'?: string;
}

/** An on / off setting that applies at once (design system: Switch). */
export function Switch({ checked, onChange, className, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        onChange(!checked);
      }}
      className={cn(
        'group inline-flex h-control-sm shrink-0 items-center rounded-full focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative h-6.5 w-11 rounded-full transition-colors duration-100 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-focus',
          checked ? 'bg-heat-tint ring-1 ring-heat ring-inset' : 'bg-border-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.75 left-0.75 size-5 rounded-full transition duration-100 motion-reduce:transition-none',
            checked ? 'translate-x-4.5 bg-heat' : 'bg-ink-muted',
          )}
        />
      </span>
    </button>
  );
}
