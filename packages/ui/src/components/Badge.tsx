import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-sm px-2 py-1 text-badge uppercase', {
  variants: {
    tone: {
      air: 'bg-air-tint text-air',
      heat: 'bg-heat-tint text-heat',
      neutral: 'bg-surface-raised text-ink-muted',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

/** Short uppercase status label: `AUTO` (air), `MANUAL` (heat), `BUILT-IN` (neutral). */
export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
