import { Button, ConfirmDialog, cn } from '@roastpilot/ui';
import { useState, type ReactNode } from 'react';

export interface ConfirmButtonProps {
  /** The button that asks, e.g. "End roast". */
  label: string;
  icon?: ReactNode;
  /** The question, then what happens, e.g. "End the roast? · everything turns off". */
  question: string;
  /** The confirming button; the action's verb. */
  confirmLabel: string;
  onConfirm: () => void;
  /** For narrow panels: a full-width button. */
  stacked?: boolean;
  /** How the asking button looks: quiet by default, `secondary` for the one normal stop. */
  variant?: 'ghost' | 'secondary';
  /** Deletes something: both buttons in red text (`critical-text`), never a red fill. */
  destructive?: boolean;
  /** Stops something normally (End roast): both buttons and the icon in amber, never red. */
  caution?: boolean;
  /** Up to 3 lines on what happens now, in place of the part after " · " in `question`. */
  consequences?: readonly string[];
  /** The dialog's keep-going answer: "Keep roasting". */
  cancelLabel?: string;
  className?: string;
}

/** An action that asks once in a dialog first (docs/spec/ui.md, Confirmations). */
export function ConfirmButton({
  label,
  icon,
  question,
  confirmLabel,
  onConfirm,
  stacked = false,
  variant = 'ghost',
  destructive = false,
  caution = false,
  consequences,
  cancelLabel,
  className,
}: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);
  // "Question? · what happens": the dialog shows them as its title and one line under it.
  const [title = question, detail] = question.split(' · ');
  return (
    <>
      <Button
        variant={variant}
        size={stacked ? 'md' : 'sm'}
        icon={icon}
        className={cn(
          stacked && 'w-full',
          destructive && 'text-critical-text',
          caution && 'text-warning',
          className,
        )}
        onClick={() => {
          setAsking(true);
        }}
      >
        {label}
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        question={title}
        detail={detail}
        confirmLabel={confirmLabel}
        destructive={destructive}
        caution={caution}
        icon={icon}
        consequences={consequences}
        {...(cancelLabel ? { cancelLabel } : {})}
        onConfirm={onConfirm}
      />
    </>
  );
}
