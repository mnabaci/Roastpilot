import * as Popover from '@radix-ui/react-popover';
import { useEffect, useId, useRef, useState, type ReactElement } from 'react';

/** How long the pointer rests, or keyboard focus stays, before the tooltip opens. */
export const TOOLTIP_DELAY_MS = 500;

export interface TooltipProps {
  /** The whole text, e.g. a truncated line in full. */
  content: string;
  /** The trigger: one focusable element, such as a row's button. */
  children: ReactElement;
}

/**
 * The whole of a truncated line, on hover or keyboard focus after a short rest (design system:
 * Tooltip). App-styled and themed, never the system `title`; it never takes focus.
 */
export function Tooltip({ content, children }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // A click focuses its trigger too: that focus isn't a reason to open.
  const pressed = useRef(false);
  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  const show = () => {
    cancel();
    timer.current = setTimeout(() => {
      setOpen(true);
    }, TOOLTIP_DELAY_MS);
  };
  const hide = () => {
    cancel();
    setOpen(false);
  };
  useEffect(() => cancel, []);
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) hide();
      }}
    >
      <Popover.Anchor
        asChild
        aria-describedby={open ? id : undefined}
        onPointerEnter={show}
        onPointerLeave={hide}
        onPointerDown={() => {
          pressed.current = true;
          hide();
        }}
        onFocus={() => {
          if (!pressed.current) show();
          pressed.current = false;
        }}
        onBlur={hide}
      >
        {children}
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          id={id}
          role="tooltip"
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
          }}
          className="pointer-events-none z-50 max-w-96 rounded-md border border-border-strong bg-surface-raised px-3 py-1.5 text-label text-ink"
        >
          {content}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
