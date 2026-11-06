import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { cn } from '../lib/utils';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The question, e.g. "Delete this roast?". */
  question: string;
  /** One line on what happens, e.g. "can't be undone". */
  detail?: string | undefined;
  /** The confirming button: the action's verb. */
  confirmLabel: string;
  onConfirm: () => void;
  /** Deletes something: the verb in red text (`critical-text`), never a red fill. */
  destructive?: boolean;
  /** A second answer beside the verb, e.g. "Keep deducted" next to "Return to stock". */
  alternative?: { label: string; onSelect: () => void } | undefined;
}

/**
 * Asks once before something that can't be undone or ends something (design system: ConfirmDialog).
 * Opens only from the user's own click; Escape or Cancel closes it, and focus starts on Cancel.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  question,
  detail,
  confirmLabel,
  onConfirm,
  destructive = false,
  alternative,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-bg/70" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-full max-w-100 -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-border-strong bg-surface p-5">
          <div className="flex flex-col gap-1">
            <AlertDialog.Title className="text-heading">{question}</AlertDialog.Title>
            {detail ? (
              <AlertDialog.Description className="text-body text-ink-muted">
                {detail}
              </AlertDialog.Description>
            ) : (
              <AlertDialog.Description className="sr-only">{question}</AlertDialog.Description>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </AlertDialog.Cancel>
            {alternative ? (
              <AlertDialog.Action asChild>
                <Button onClick={alternative.onSelect}>{alternative.label}</Button>
              </AlertDialog.Action>
            ) : null}
            <AlertDialog.Action asChild>
              <Button className={cn(destructive && 'text-critical-text')} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
