import { cn } from '../lib/utils';
import { Button } from './Button';

interface CoachCardBase {
  /** A line under the label, e.g. "Light · Steps needs calibration". */
  note?: string;
  onDismiss: () => void;
  className?: string;
}

interface CoachSuggestionProps extends CoachCardBase {
  variant?: 'suggestion';
  /** The suggested change, e.g. "Heater 65% → 75%". */
  change: string;
  /** Why, in one line, e.g. "4 °C below target, RoR falling". */
  reason: string;
  onApply: () => void;
}

interface CoachHeadsUpProps extends CoachCardBase {
  /** Nothing to change: a line and Dismiss, in the neutral tint. */
  variant: 'heads-up';
  /** e.g. "First crack in ~45 s · listen". */
  line: string;
}

export type CoachCardProps = CoachSuggestionProps | CoachHeadsUpProps;

/** On the heat tint and on surface-raised alike, the outline makes Dismiss read as a button. */
const DISMISS_CLASS = 'border border-border-strong';

/** "Coach suggests", then the note when there is one. */
function Label({ text, note }: { text: string; note: string | undefined }) {
  return <p className="text-label text-ink-muted">{note ? `${text} · ${note}` : text}</p>;
}

/**
 * Manual-mode coach: what Auto would set now, why, and a one-tap Apply; or a heads-up before first
 * crack or drop, with Dismiss only. Compact, so the sliders under it stay in view.
 */
export function CoachCard(props: CoachCardProps) {
  const { note, onDismiss, className } = props;
  if (props.variant === 'heads-up') {
    return (
      <section
        aria-label="Coach heads-up"
        className={cn(
          'flex flex-col items-start gap-2 rounded-xl border border-border bg-surface-raised px-4 py-3',
          className,
        )}
      >
        <Label text="Heads-up" note={note} />
        <p className="text-body text-ink">{props.line}</p>
        <Button variant="secondary" size="sm" className={DISMISS_CLASS} onClick={onDismiss}>
          Dismiss
        </Button>
      </section>
    );
  }
  return (
    <section
      aria-label="Coach suggestion"
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-heat bg-heat-tint px-4 py-3',
        className,
      )}
    >
      <Label text="Coach suggests" note={note} />
      <p className="text-readout-lg text-ink">{props.change}</p>
      <p className="text-body text-ink-muted">{props.reason}</p>
      <div className="flex gap-2.5">
        <Button variant="primary" size="sm" className="flex-1" onClick={props.onApply}>
          Apply
        </Button>
        <Button variant="secondary" size="sm" className={DISMISS_CLASS} onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </section>
  );
}
