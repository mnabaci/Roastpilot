import { Star } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { cn } from '../lib/utils';
import { Badge } from './Badge';

export interface RoastListItem {
  id: number;
  /** Date and time, e.g. `Wed 4 Nov · 14:32`. */
  title: string;
  /** One line of numbers, e.g. `9:40 · FC 8:00 · 205.5 °C`. */
  numbers: string;
  /** A second line, e.g. `Yirgacheffe · Light · Steps · 4/5`. */
  detail?: string;
  /** Marked with a filled star. */
  favourite?: boolean;
  /** A short status, e.g. `Unfinished`. */
  badge?: string;
}

export interface RoastListProps {
  /** Accessible name of the list. */
  label: string;
  items: readonly RoastListItem[];
  selectedId: number | undefined;
  onSelect: (id: number) => void;
  className?: string;
}

/** Up and Down move focus between rows. */
function moveFocus(event: KeyboardEvent<HTMLButtonElement>): void {
  const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
  const list = event.currentTarget.closest('ul');
  if (step === undefined || !list) return;
  const rows = [...list.querySelectorAll('button')];
  const at = rows.indexOf(event.currentTarget);
  const next = rows[at + step];
  if (at === -1 || !next) return;
  event.preventDefault();
  next.focus();
}

/** Saved roasts, newest first, one selected (design system: RoastList). Scrolls inside. */
export function RoastList({ label, items, selectedId, onSelect, className }: RoastListProps) {
  return (
    <ul
      aria-label={label}
      className={cn(
        'min-h-0 divide-y divide-border overflow-y-auto rounded-xl bg-surface',
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <li key={item.id}>
            <button
              type="button"
              aria-current={selected ? 'true' : undefined}
              onKeyDown={moveFocus}
              onClick={() => {
                onSelect(item.id);
              }}
              className={cn(
                'flex min-h-control-sm w-full flex-col justify-center gap-0.5 px-4 py-3 text-left tabular-nums focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                selected ? 'bg-heat-tint' : 'hover:bg-surface-hover',
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-body font-semibold text-ink">{item.title}</span>
                  {item.favourite ? (
                    <Star
                      role="img"
                      aria-label="Favourite"
                      className="size-3.5 shrink-0 text-heat"
                      fill="currentColor"
                    />
                  ) : null}
                </span>
                {item.badge ? <Badge className="shrink-0">{item.badge}</Badge> : null}
              </span>
              {item.numbers ? (
                <span className="truncate text-label text-ink-muted">{item.numbers}</span>
              ) : null}
              {item.detail ? (
                <span className="truncate text-label text-ink-muted">{item.detail}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
