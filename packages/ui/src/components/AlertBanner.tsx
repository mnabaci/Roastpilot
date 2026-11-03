import type { ReactNode } from 'react';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './Button';

export interface AlertBannerProps {
  /** `critical` for safety trips and lost connection, `warning` for stalls and low stock. */
  kind: 'critical' | 'warning';
  /** One line: what happened, then what the app did. */
  children: ReactNode;
  onDismiss?: () => void;
  /** Button text for `onDismiss`, e.g. "Acknowledge" for a safety trip. */
  dismissLabel?: string;
  className?: string;
}

/** A full-width banner that needs attention without blocking the roast. Never a modal. */
export function AlertBanner({
  kind,
  children,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
}: AlertBannerProps) {
  const critical = kind === 'critical';
  const Icon = critical ? TriangleAlert : CircleAlert;
  return (
    <div
      role={critical ? 'alert' : 'status'}
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-4.5 py-3',
        critical ? 'border-critical bg-critical-surface' : 'border-warning bg-surface-raised',
        className,
      )}
    >
      <p className="flex items-center gap-2.5 text-body font-semibold text-ink">
        <Icon
          aria-hidden="true"
          className={cn('size-5 shrink-0', critical ? 'text-critical-text' : 'text-warning')}
        />
        {children}
      </p>
      {onDismiss ? (
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          {dismissLabel}
        </Button>
      ) : null}
    </div>
  );
}
