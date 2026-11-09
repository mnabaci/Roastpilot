import { Star } from 'lucide-react';
import type { ReactElement } from 'react';
import { moveFocusInList } from '../lib/list-focus';
import { cn } from '../lib/utils';
import { Badge } from './Badge';
import { TickBox } from './tick-box';
import { Tooltip } from './Tooltip';

export interface RoastListItem {
  id: number;
  /** Date and time, e.g. `Wed 4 Nov · 14:32`. */
  title: string;
  /** One line of numbers, e.g. `9:40 · FC 8:00 · 205.5 °C`. */
  numbers: string;
  /**
   * A second line in parts, joined with ` · `, e.g. `Yirgacheffe`, `Auto · Light · Steps`, `4/5`.
   * When it doesn't fit, the first part gives way first; the whole line is in a tooltip.
   */
  detail?: readonly string[];
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
  /** Select mode: rows are checkboxes; `onCheck` gets the row and whether Shift asked for a range. */
  checked?: ReadonlySet<number> | undefined;
  onCheck?: (id: number, range: boolean) => void;
  className?: string;
}

/** Saved roasts, newest first, one selected (design system: RoastList). Scrolls inside. */
export function RoastList({
  label,
  items,
  selectedId,
  onSelect,
  checked,
  onCheck,
  className,
}: RoastListProps) {
  const selecting = checked !== undefined && onCheck !== undefined;
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
        const ticked = selecting && checked.has(item.id);
        return (
          <li key={item.id}>
            <WholeLine parts={item.detail}>
              <button
                type="button"
                {...(selecting
                  ? { role: 'checkbox', 'aria-checked': ticked }
                  : { 'aria-current': selected ? ('true' as const) : undefined })}
                onKeyDown={moveFocusInList}
                onClick={(event) => {
                  if (selecting) onCheck(item.id, event.shiftKey);
                  else onSelect(item.id);
                }}
                className={cn(
                  'flex min-h-control-sm w-full flex-col justify-center gap-0.5 px-4 py-3 text-left tabular-nums focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                  (selecting ? ticked : selected) ? 'bg-surface-raised' : 'hover:bg-surface-hover',
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {selecting ? <TickBox ticked={ticked} /> : null}
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
                {item.detail && item.detail.length > 0 ? <DetailLine parts={item.detail} /> : null}
              </button>
            </WholeLine>
          </li>
        );
      })}
    </ul>
  );
}

const SEPARATOR = ' · ';

/** A row with a second line gets the whole line in a tooltip; one without needs none. */
function WholeLine({
  parts,
  children,
}: {
  parts: readonly string[] | undefined;
  children: ReactElement;
}) {
  return parts && parts.length > 0 ? (
    <Tooltip content={parts.join(SEPARATOR)}>{children}</Tooltip>
  ) : (
    children
  );
}

/**
 * The second line: the first part (the bean) shrinks to its ellipsis before the rest truncates
 * ("African… · Auto · Light · Steps"), with flexbox, not measuring text.
 */
function DetailLine({ parts }: { parts: readonly string[] }) {
  const [first, ...rest] = parts;
  return (
    <span className="flex min-w-0 text-label text-ink-muted">
      <span className="min-w-0 truncate">{first}</span>
      {rest.length > 0 ? (
        // A no-break space, so the separator's leading space isn't trimmed.
        <span className="max-w-full shrink-0 truncate">{`\u00a0·\u00a0${rest.join(SEPARATOR)}`}</span>
      ) : null}
    </span>
  );
}
