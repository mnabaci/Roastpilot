import { Button, cn } from '@roastpilot/ui';
import { useState, type ReactNode } from 'react';

export interface ConfirmInlineProps {
  /** The button that asks, e.g. "End roast". */
  label: string;
  icon?: ReactNode;
  /** One line: the question, then what happens, e.g. "End the roast? · everything turns off". */
  question: string;
  /** The confirming button; the action's verb. */
  confirmLabel: string;
  onConfirm: () => void;
  /** For narrow panels: a full-width button, and the question above its answers. */
  stacked?: boolean;
  className?: string;
}

/** A quiet action that asks once, inline, never in a dialog (no modals during a roast). */
export function ConfirmInline({
  label,
  icon,
  question,
  confirmLabel,
  onConfirm,
  stacked = false,
  className,
}: ConfirmInlineProps) {
  const [asking, setAsking] = useState(false);
  // In a panel, the same size as the flow buttons around it.
  const size = stacked ? 'md' : 'sm';
  if (!asking)
    return (
      <Button
        variant="ghost"
        size={size}
        icon={icon}
        className={cn(stacked && 'w-full', className)}
        onClick={() => {
          setAsking(true);
        }}
      >
        {label}
      </Button>
    );
  return (
    <div
      role="group"
      aria-label={question}
      className={cn('flex gap-2', stacked ? 'flex-col' : 'flex-wrap items-center', className)}
    >
      <span className="text-label text-ink-muted">{question}</span>
      <div className={cn('flex gap-2', stacked && '*:flex-1')}>
        <Button
          size={size}
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
        <Button
          variant="ghost"
          size={size}
          onClick={() => {
            setAsking(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
