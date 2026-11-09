import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Button } from './Button';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The dialog's name, as its heading: "Batch calculator". */
  title: string;
  /** One line under the title on what it's for; read as the dialog's description. */
  description?: string | undefined;
  children: ReactNode;
  className?: string;
}

/**
 * A small window over the screen for a tool you use and close (design system: Dialog): a title,
 * an icon-only Close, and its content. Escape, Close or a click outside closes it, and focus goes
 * back to what opened it. Asking before something can't be undone is ConfirmDialog's job.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-bg/70" />
        <RadixDialog.Content
          className={cn(
            // Centred by auto margins inside a 16px inset: never wider or taller than the window
            // less 16px a side, and it scrolls inside when its content is taller.
            'fixed inset-4 z-50 m-auto flex h-fit max-h-full max-w-140 flex-col gap-5 overflow-y-auto rounded-xl border border-border-strong bg-surface p-5',
            className,
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2">
              <RadixDialog.Title className="text-heading text-ink">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="text-label text-ink-muted">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Close"
                className="-mt-1 -mr-2"
                icon={<X aria-hidden="true" />}
              />
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
