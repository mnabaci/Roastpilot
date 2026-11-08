import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const valueVariants = cva('text-readout-xl tabular-nums', {
  variants: {
    tone: { heat: 'text-heat', air: 'text-air', ink: 'text-ink' },
  },
  defaultVariants: { tone: 'ink' },
});

export interface StatCardProps
  extends Omit<ComponentProps<'section'>, 'children'>, VariantProps<typeof valueVariants> {
  label: string;
  /** The live value. `null`, `undefined` or a non-finite number shows an em dash, never 0. */
  value: string | number | null | undefined;
  unit?: string;
  /** One line of context under the value, e.g. "Target 196 °C". */
  context?: string;
}

/** A readout's minus is the typographic one: a hyphen sits low and narrow, apart from the digits. */
const withMinus = (value: string | number) => String(value).replace(/^-/, '\u2212');

/** A big live number with a label above and one line of context below. */
export function StatCard({
  label,
  value,
  unit,
  context,
  tone,
  className,
  ...props
}: StatCardProps) {
  const hasValue =
    typeof value === 'number'
      ? Number.isFinite(value)
      : value !== null && value !== undefined && value !== '';
  return (
    <section
      aria-label={label}
      className={cn('flex flex-col gap-1.5 rounded-xl bg-surface px-5 py-4.5', className)}
      {...props}
    >
      <p className="text-label text-ink-muted">{label}</p>
      <p className="flex flex-wrap items-baseline gap-x-1.5">
        <span className={valueVariants({ tone })}>{hasValue ? withMinus(value ?? '') : '—'}</span>
        {unit && hasValue ? <span className="text-heading text-ink-muted">{unit}</span> : null}
      </p>
      {context ? <p className="text-label text-ink-muted">{context}</p> : null}
    </section>
  );
}
