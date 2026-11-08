import { cn } from '../lib/utils';
import { Button } from './Button';
import { CoachChanges, type CoachChange } from './CoachChanges';

interface CoachCardBase {
  /** Said after the label, e.g. "needs calibration". */
  note?: string;
  onDismiss: () => void;
  className?: string;
}

interface CoachSuggestionProps extends CoachCardBase {
  variant?: 'suggestion';
  /** The suggested changes, heater first: one aligned row per output. */
  changes: readonly CoachChange[];
  /** Why, in one line, e.g. "4 °C below target, RoR falling". */
  reason: string;
  onApply: () => void;
  /** Apply's call is on its way: Apply says "Applying…" and can't be pressed again. */
  applying?: boolean;
}

interface CoachHeadsUpProps extends CoachCardBase {
  /** Nothing to change: a line and Dismiss, in the neutral tint. */
  variant: 'heads-up';
  /** e.g. "First crack in ~45 s · listen". */
  line: string;
}

export type CoachCardProps = CoachSuggestionProps | CoachHeadsUpProps;

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
        <Button variant="outline" size="sm" className="self-end" onClick={onDismiss}>
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
      {/* The changes and their reason read as one block. */}
      <div className="flex flex-col gap-1">
        <CoachChanges changes={props.changes} />
        <p className="text-body text-ink-muted">{props.reason}</p>
      </div>
      {/* As in every confirmation: right-aligned, the quiet choice first, the action last. */}
      <div className="flex justify-end gap-2.5">
        <Button variant="outline" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="px-5"
          disabled={props.applying}
          aria-busy={props.applying}
          onClick={props.onApply}
        >
          {props.applying ? 'Applying…' : 'Apply'}
        </Button>
      </div>
    </section>
  );
}
