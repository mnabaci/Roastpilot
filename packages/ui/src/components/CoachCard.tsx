import { cn } from '../lib/utils';
import { Button } from './Button';

export interface CoachCardProps {
  /** The suggested change, e.g. "Heater 65% → 75%". */
  change: string;
  /** Why, in one line, e.g. "4 °C below target, RoR falling". */
  reason: string;
  onApply: () => void;
  onDismiss: () => void;
  className?: string;
}

/** Manual-mode suggestion: the next setting, why, and a one-tap Apply. */
export function CoachCard({ change, reason, onApply, onDismiss, className }: CoachCardProps) {
  return (
    <section
      aria-label="Coach suggestion"
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-heat bg-heat-tint px-5 py-4.5',
        className,
      )}
    >
      <p className="text-label text-ink-muted">Coach suggests</p>
      <p className="text-readout-lg text-ink">{change}</p>
      <p className="text-body text-ink-muted">{reason}</p>
      <div className="flex gap-2.5">
        <Button variant="primary" className="flex-1" onClick={onApply}>
          Apply
        </Button>
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </section>
  );
}
