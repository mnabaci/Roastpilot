import type { ReactNode } from 'react';
import { moveFocusInList } from '../lib/list-focus';
import { cn } from '../lib/utils';

export interface NavListItem<T> {
  id: T;
  label: string;
  /** A second line, e.g. a bean's origin. */
  detail?: string;
  /** Trailing status, e.g. an `Edited` or `Active` badge. */
  badge?: ReactNode;
}

export interface NavListProps<T> {
  /** Accessible name of the list. */
  label: string;
  items: readonly NavListItem<T>[];
  openId: T | undefined;
  onOpen: (id: T) => void;
  className?: string;
}

/** The things in a sidebar, one open, in grey (design system: NavList). */
export function NavList<T extends string | number>({
  label,
  items,
  openId,
  onOpen,
  className,
}: NavListProps<T>) {
  return (
    <ul aria-label={label} className={cn('flex flex-col gap-1', className)}>
      {items.map((item) => {
        const open = item.id === openId;
        return (
          <li key={item.id}>
            <button
              type="button"
              title={item.label}
              aria-current={open ? 'true' : undefined}
              onKeyDown={moveFocusInList}
              onClick={() => {
                onOpen(item.id);
              }}
              className={cn(
                'flex min-h-control-sm w-full items-center gap-2 rounded-md px-3 py-1.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                open
                  ? 'bg-surface-raised text-ink'
                  : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body">{item.label}</span>
                {item.detail ? (
                  <span className="truncate text-label text-ink-muted">{item.detail}</span>
                ) : null}
              </span>
              {item.badge}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
