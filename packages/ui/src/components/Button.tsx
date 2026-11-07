import type { ComponentProps, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition duration-100 active:scale-98 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-heat-fill text-on-heat hover:bg-heat-fill-hover',
        secondary: 'bg-surface-raised text-ink hover:bg-surface-hover',
        // Secondary with an outline: Dismiss and Done that close a card. The outline keeps it a
        // button on any background (heat tint, surface-raised, surface in Dark).
        outline: 'border border-border-strong bg-surface-raised text-ink hover:bg-surface-hover',
        ghost: 'bg-transparent text-ink hover:bg-surface-hover',
        danger: 'bg-critical text-on-critical hover:brightness-110',
      },
      size: {
        // Never narrower than tall, so a one-digit or icon-only button still makes a 44 px target.
        sm: 'h-control-sm min-w-control-sm px-3.5 text-label',
        md: 'h-control-md min-w-control-md px-4 text-body',
        lg: 'h-control-lg w-full px-5 text-heading',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  /** Lucide icon shown before the label. */
  icon?: ReactNode;
}

/**
 * Compact, tonal button. Use one `primary` per screen state (size `lg` for the phase action),
 * `secondary` for other actions, `outline` for Dismiss / Done that close a card, `ghost` for
 * low-priority ones and `danger` only for Emergency stop.
 */
export function Button({
  variant,
  size,
  icon,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {icon}
      {children}
    </button>
  );
}
