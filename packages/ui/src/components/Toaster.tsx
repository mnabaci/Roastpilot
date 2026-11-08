import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';

export type ToastKind = 'error' | 'info' | 'success';

export interface ToastMessage {
  id: string;
  /** `error` stays until dismissed; `info` and `success` fade on their own. */
  kind: ToastKind;
  /** One line: verb, what, next step. "Couldn't delete the roast · try again". */
  text: string;
}

export interface ToasterProps {
  /** Oldest first; the newest shows at the bottom. */
  toasts: readonly ToastMessage[];
  /** × was pressed, or an info/success toast faded out. */
  onDismiss: (id: string) => void;
  className?: string;
}

/** How long an info or success toast shows before it fades. */
export const TOAST_SHOW_MS = 4_000;
/** The fade itself; the toast is dismissed once it ends. */
export const TOAST_FADE_MS = 200;
const MAX_VISIBLE = 3;

const ICON = { error: CircleAlert, success: CircleCheck, info: Info } as const;
const ICON_TONE: Readonly<Record<ToastKind, string>> = {
  error: 'text-warning',
  success: 'text-good',
  info: 'text-ink-muted',
};

/**
 * One-line notes, bottom-right, for actions that failed (or finished) where the screen shows
 * nothing (design system: Toast). Never for safety, never a modal.
 */
export function Toaster({ toasts, onDismiss, className }: ToasterProps) {
  return (
    <div
      className={cn(
        'pointer-events-none fixed right-6 bottom-6 z-40 flex w-full max-w-112 flex-col items-end gap-2',
        className,
      )}
    >
      {toasts.slice(-MAX_VISIBLE).map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const { id, kind, text } = toast;
  const error = kind === 'error';
  // Hovered or focused: a timed toast waits, so it can be read and reached by keyboard.
  const [held, setHeld] = useState(false);
  const [fading, setFading] = useState(false);
  // The latest handler, so a parent re-render doesn't restart the timer.
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });
  useEffect(() => {
    if (error || held) return undefined;
    const timer = fading
      ? setTimeout(() => {
          dismiss.current(id);
        }, TOAST_FADE_MS)
      : setTimeout(() => {
          setFading(true);
        }, TOAST_SHOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [error, held, fading, id]);
  const hold = () => {
    setHeld(true);
    setFading(false);
  };
  const release = () => {
    setHeld(false);
  };
  const Icon = ICON[kind];
  return (
    <div
      role={error ? 'alert' : 'status'}
      onMouseEnter={hold}
      onMouseLeave={release}
      onFocus={hold}
      onBlur={release}
      className={cn(
        'pointer-events-auto flex w-full items-center gap-2 rounded-lg border bg-surface-raised py-1 pr-1 pl-4 transition-opacity duration-200 motion-reduce:transition-none',
        error ? 'border-warning' : 'border-border-strong',
        fading && 'opacity-0',
      )}
    >
      <Icon aria-hidden="true" className={cn('size-5 shrink-0', ICON_TONE[kind])} />
      <p className="min-w-0 flex-1 text-body text-ink">{text}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          onDismiss(id);
        }}
        className="flex size-control-sm shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
