import type { KeyboardEvent } from 'react';
import { cn } from '../lib/utils';

export interface SegmentedOption<T> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T> {
  /** Names the group for screen readers, usually the setting's name. */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

const STEP: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/** One choice from a short fixed set, applied at once (design system: SegmentedControl). */
export function SegmentedControl<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
  disabled,
  className,
}: SegmentedControlProps<T>) {
  const at = options.findIndex((o) => o.value === value);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = STEP[event.key];
    if (step === undefined || disabled || options.length === 0) return;
    event.preventDefault();
    const next = options[(Math.max(at, 0) + step + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    // Focus follows the choice, as in a native radio group.
    const group = event.currentTarget.parentElement;
    queueMicrotask(() => {
      group?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    });
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled}
      className={cn(
        'inline-flex flex-wrap gap-0.5 rounded-md bg-surface-raised p-1',
        disabled && 'opacity-50',
        className,
      )}
    >
      {options.map((option, i) => {
        const chosen = i === at;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={chosen}
            // Only the chosen segment is a Tab stop; arrows move between them.
            tabIndex={chosen || (at === -1 && i === 0) ? 0 : -1}
            disabled={disabled}
            onKeyDown={onKeyDown}
            onClick={() => {
              onChange(option.value);
            }}
            className={cn(
              // The pill is 36 px inside the group's 4 px padding; the hit area reaches into that
              // padding, so each option is a full 44 px (control-sm) target.
              'relative h-9 rounded-sm px-3 text-body font-semibold whitespace-nowrap tabular-nums before:absolute before:inset-x-0 before:-inset-y-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed',
              chosen
                ? 'bg-heat-tint text-heat'
                : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
