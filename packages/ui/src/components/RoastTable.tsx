import { ChevronRight, Star } from 'lucide-react';
import { cn } from '../lib/utils';
import { Tooltip } from './Tooltip';

export interface RoastTableRow {
  id: number;
  /** Date and time, e.g. `Sun 8 Nov · 16:45`. */
  title: string;
  /** Marked with a filled star after the title. */
  favourite?: boolean;
  /** How it ran: `Auto · Light · Steps`, or `Manual`. */
  ran: string;
  /** Formatted values with units; undefined shows a dash. */
  time: string | undefined;
  fc: string | undefined;
  drop: string | undefined;
  /** Green → roasted, e.g. `356 → 305 g`. */
  weights: string | undefined;
  loss: string | undefined;
  rating: string | undefined;
}

const NUMBERS = ['time', 'fc', 'drop', 'weights', 'loss', 'rating'] as const;

const TITLES: Record<(typeof NUMBERS)[number], string> = {
  time: 'Time',
  fc: 'FC',
  drop: 'Drop',
  weights: 'Green → roasted',
  loss: 'Loss',
  rating: 'Rating',
};

/**
 * Saved roasts side by side, one row each, the numbers in columns that line up (design system,
 * RoastTable). With `onOpen`, each roast's date is a button that opens it, and so is its row.
 */
export function RoastTable({
  label,
  rows,
  onOpen,
  className,
}: {
  /** Accessible name of the table. */
  label: string;
  rows: readonly RoastTableRow[];
  /** Opens a roast: the date is its button, and a click anywhere on the row does the same. */
  onOpen?: ((id: number) => void) | undefined;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl bg-surface px-4 py-3', className)}>
      <table aria-label={label} className="w-full border-collapse text-label tabular-nums">
        <thead>
          <tr className="text-ink-muted">
            <th scope="col" className="pb-2 pr-4 text-left font-medium whitespace-nowrap">
              Roast
            </th>
            {/* Takes the room the numbers leave, and cuts a long profile name short. */}
            <th scope="col" className="w-full max-w-0 pb-2 text-left font-medium">
              Ran as
            </th>
            {NUMBERS.map((key) => (
              <th
                key={key}
                scope="col"
                className="pb-2 pl-4 text-right font-medium whitespace-nowrap"
              >
                {TITLES[key]}
              </th>
            ))}
            {onOpen ? (
              <th scope="col" className="pb-2 pl-3">
                <span className="sr-only">Open</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                'border-t border-border text-ink',
                // A 44px target once rows open a roast.
                onOpen && 'h-control-sm cursor-pointer hover:bg-surface-hover',
              )}
              // The row is the mouse's way in; the date's button is the keyboard's.
              onClick={
                onOpen
                  ? () => {
                      onOpen(row.id);
                    }
                  : undefined
              }
            >
              <th scope="row" className="py-3 pr-4 text-left font-semibold whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  {onOpen ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        // The row opens it too: once is enough.
                        event.stopPropagation();
                        onOpen(row.id);
                      }}
                      className="rounded-sm text-left font-semibold underline decoration-border-strong underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {row.title}
                    </button>
                  ) : (
                    row.title
                  )}
                  {row.favourite ? (
                    <Star
                      role="img"
                      aria-label="Favourite"
                      className="size-3.5 shrink-0 text-heat"
                      fill="currentColor"
                    />
                  ) : null}
                </span>
              </th>
              <Tooltip content={row.ran}>
                <td className="max-w-0 truncate py-3 text-ink-muted">{row.ran}</td>
              </Tooltip>
              {NUMBERS.map((key) => (
                <td key={key} className="py-3 pl-4 text-right whitespace-nowrap">
                  {row[key] ?? '–'}
                </td>
              ))}
              {onOpen ? (
                <td className="py-3 pl-3 text-ink-muted">
                  <ChevronRight aria-hidden="true" className="size-4" />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
