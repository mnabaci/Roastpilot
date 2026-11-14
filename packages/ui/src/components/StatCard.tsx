import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

/** What a reading's colour means (design system: Colour): heat, air, ET, or plain. */
const TONE_TEXT = { heat: 'text-heat', air: 'text-air', env: 'text-env', ink: 'text-ink' } as const;

const valueVariants = cva('tabular-nums', {
  variants: { tone: TONE_TEXT, size: { default: 'text-readout-xl', compact: 'text-readout-lg' } },
  defaultVariants: { tone: 'ink', size: 'default' },
});

/** Compact: a smaller tile inside a card, e.g. one of a board's inputs on the Roasters page. */
const cardVariants = cva('flex flex-col', {
  variants: {
    size: {
      default: 'gap-1.5 rounded-xl bg-surface px-5 py-4.5',
      compact: 'gap-1 rounded-lg bg-surface-raised px-3 py-2',
    },
  },
  defaultVariants: { size: 'default' },
});

const unitVariants = cva('text-ink-muted', {
  variants: { size: { default: 'text-heading', compact: 'text-label' } },
  defaultVariants: { size: 'default' },
});

export interface StatCardProps
  extends Omit<ComponentProps<'section'>, 'children'>, VariantProps<typeof valueVariants> {
  label: string;
  /** The live value. `null`, `undefined` or a non-finite number shows an em dash, never 0. */
  value: string | number | null | undefined;
  unit?: string;
  /** One line of context under the value, e.g. "Target 196 °C". */
  context?: string;
  /**
   * A second, smaller reading on the label's row, e.g. ET beside the temperature ("ET 212.4 °C").
   * Its value shows a dash when unknown, like the main one.
   */
  secondary?: {
    label: string;
    value: string | number | null | undefined;
    unit?: string;
    tone?: VariantProps<typeof valueVariants>['tone'];
  };
  /** One of several small tiles inside a card; secondary readings are for the default size. */
  size?: 'default' | 'compact';
}

// The row is the label's height (see below), so the card's readout stays level with the cards
// beside it.
const secondaryVariants = cva('text-heading leading-(--text-label--line-height) tabular-nums', {
  variants: { tone: TONE_TEXT },
  defaultVariants: { tone: 'ink' },
});

/** A readout's minus is the typographic one: a hyphen sits low and narrow, apart from the digits. */
const withMinus = (value: string | number) => String(value).replace(/^-/, '\u2212');

const isKnown = (value: string | number | null | undefined): value is string | number =>
  typeof value === 'number'
    ? Number.isFinite(value)
    : value !== null && value !== undefined && value !== '';

/** The smaller reading on the label's row: label, value, then unit once the value is known. */
function SecondaryReading({ label, value, unit, tone }: NonNullable<StatCardProps['secondary']>) {
  return (
    <p className="flex shrink-0 items-baseline gap-1.5">
      <span className="text-label text-ink-muted">{label}</span>
      <span className={secondaryVariants({ tone })}>{isKnown(value) ? withMinus(value) : '—'}</span>
      {unit && isKnown(value) ? <span className="text-label text-ink-muted">{unit}</span> : null}
    </p>
  );
}

/** A big live number with a label above and one line of context below. */
export function StatCard({
  label,
  value,
  unit,
  context,
  secondary,
  tone,
  size,
  className,
  ...props
}: StatCardProps) {
  const hasValue = isKnown(value);
  return (
    <section aria-label={label} className={cn(cardVariants({ size }), className)} {...props}>
      {secondary ? (
        <div className="flex h-(--text-label--line-height) min-w-0 items-center justify-between gap-3">
          <p className="truncate text-label text-ink-muted">{label}</p>
          <SecondaryReading {...secondary} />
        </div>
      ) : (
        <p className="text-label text-ink-muted">{label}</p>
      )}
      <p className="flex flex-wrap items-baseline gap-x-1.5">
        <span className={valueVariants({ tone, size })}>{hasValue ? withMinus(value) : '—'}</span>
        {unit && hasValue ? <span className={unitVariants({ size })}>{unit}</span> : null}
      </p>
      {context ? <p className="text-label text-ink-muted">{context}</p> : null}
    </section>
  );
}
