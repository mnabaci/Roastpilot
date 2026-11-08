import * as AlertDialog from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';
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
  /** Stops something normally, like End roast: the verb and icon in amber (`warning`), never red. */
  caution?: boolean;
  /** Before the question, in the tone's colour. */
  icon?: ReactNode;
  /** Up to 3 short lines on what happens now; they take the detail line's place. */
  consequences?: readonly string[] | undefined;
  /** The button that keeps things as they are: "Keep roasting". Focus starts on it. */
  cancelLabel?: string;
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
  caution = false,
  icon,
  consequences,
  cancelLabel = 'Cancel',
  alternative,
}: ConfirmDialogProps) {
  const toneText = destructive ? 'text-critical-text' : caution ? 'text-warning' : undefined;
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-bg/70" />
        <AlertDialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-border-strong bg-surface p-5',
            // Three answers need the room to stay on one line each.
            alternative ? 'max-w-120' : 'max-w-100',
          )}
        >
          <div className="flex flex-col gap-1">
            <AlertDialog.Title className="flex items-center gap-2 text-heading">
              {icon ? (
                <span aria-hidden="true" className={cn('flex [&_svg]:size-5', toneText)}>
                  {icon}
                </span>
              ) : null}
              {question}
            </AlertDialog.Title>
            {consequences && consequences.length > 0 ? (
              <AlertDialog.Description asChild>
                <ul className="flex list-disc flex-col gap-0.5 pl-5 text-body text-ink-muted">
                  {consequences.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </AlertDialog.Description>
            ) : detail ? (
              <AlertDialog.Description className="text-body text-ink-muted">
                {detail}
              </AlertDialog.Description>
            ) : (
              <AlertDialog.Description className="sr-only">{question}</AlertDialog.Description>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2 [&>button]:whitespace-nowrap">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">{cancelLabel}</Button>
            </AlertDialog.Cancel>
            {alternative ? (
              <AlertDialog.Action asChild>
                <Button onClick={alternative.onSelect}>{alternative.label}</Button>
              </AlertDialog.Action>
            ) : null}
            <AlertDialog.Action asChild>
              <Button icon={icon} className={toneText} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
