import { Star } from 'lucide-react';
import { cn } from '../lib/utils';

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
 * RoastTable). For reading and comparing, so rows are not buttons.
 */
export function RoastTable({
  label,
  rows,
  className,
}: {
  /** Accessible name of the table. */
  label: string;
  rows: readonly RoastTableRow[];
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
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border text-ink">
              <th scope="row" className="py-2.5 pr-4 text-left font-semibold whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  {row.title}
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
              <td className="max-w-0 truncate py-2.5 text-ink-muted" title={row.ran}>
                {row.ran}
              </td>
              {NUMBERS.map((key) => (
                <td key={key} className="py-2.5 pl-4 text-right whitespace-nowrap">
                  {row[key] ?? '–'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
