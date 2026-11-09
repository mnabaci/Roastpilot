import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { moveFocusInList } from '../lib/list-focus';
import { cn } from '../lib/utils';
import { TickBox } from './tick-box';
import { Tooltip } from './Tooltip';

export interface NavListItem<T> {
  id: T;
  label: string;
  /** A second line, e.g. a bean's origin. */
  detail?: string;
  /** Trailing status, e.g. an `Edited` or `Active` badge. */
  badge?: ReactNode;
  /** Select mode: this one can't be ticked; say why in `detail` ("Built-in"). */
  locked?: boolean;
}

export interface NavListProps<T> {
  /** Accessible name of the list. */
  label: string;
  items: readonly NavListItem<T>[];
  openId: T | undefined;
  onOpen: (id: T) => void;
  /** Select mode: rows are checkboxes; `onCheck` gets the row and whether Shift asked for a range. */
  checked?: ReadonlySet<T> | undefined;
  onCheck?: (id: T, range: boolean) => void;
  className?: string;
}

/** The things in a sidebar, one open, in grey (design system: NavList). */
export function NavList<T extends string | number>({
  label,
  items,
  openId,
  onOpen,
  checked,
  onCheck,
  className,
}: NavListProps<T>) {
  const selecting = checked !== undefined && onCheck !== undefined;
  return (
    <ul aria-label={label} className={cn('flex flex-col gap-1', className)}>
      {items.map((item) => {
        const ticked = selecting && checked.has(item.id);
        const shown = selecting ? ticked : item.id === openId;
        const locked = selecting && item.locked === true;
        return (
          <li key={item.id}>
            {/* The whole name, for one the narrow sidebar truncates. */}
            <Tooltip content={item.label}>
              <button
                type="button"
                {...(selecting
                  ? {
                      role: 'checkbox',
                      'aria-checked': ticked,
                      'aria-disabled': locked || undefined,
                    }
                  : { 'aria-current': shown ? ('true' as const) : undefined })}
                onKeyDown={moveFocusInList}
                onClick={(event) => {
                  if (!selecting) onOpen(item.id);
                  else if (!locked) onCheck(item.id, event.shiftKey);
                }}
                className={cn(
                  'flex min-h-control-sm w-full items-center gap-2 rounded-md px-3 py-1.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                  // In select mode every row reads at full contrast, as History's do; only the
                  // open (or ticked) one is grey.
                  locked
                    ? 'cursor-not-allowed text-ink'
                    : shown
                      ? 'bg-surface-raised text-ink'
                      : selecting
                        ? 'text-ink hover:bg-surface-hover'
                        : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                )}
              >
                {/* A lock where the box would be: this one can't be ticked, the line under says why. */}
                {locked ? (
                  <Lock aria-hidden="true" className="size-5 shrink-0 p-0.5 text-ink-muted" />
                ) : selecting ? (
                  <TickBox ticked={ticked} />
                ) : null}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body">{item.label}</span>
                  {item.detail ? (
                    <span className="truncate text-label text-ink-muted">{item.detail}</span>
                  ) : null}
                </span>
                {item.badge}
              </button>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
