import { cn } from '../lib/utils';
import { StarRating } from './StarRating';

export interface CompareTableRow {
  label: string;
  /** Formatted values with units; undefined shows a dash. */
  own: string | undefined;
  other: string | undefined;
  /** This one minus the other, signed; undefined leaves the cell blank. */
  diff: string | undefined;
  /** `own` and `other` are ratings (`4`), shown as stars. */
  stars?: boolean;
}

const VALUES = ['own', 'other', 'diff'] as const;

/**
 * Two roasts' numbers side by side with the difference (design system: CompareTable). Differences
 * stay in `ink`: faster or hotter isn't better or worse.
 */
export function CompareTable({
  rows,
  otherTitle,
  className,
}: {
  rows: readonly CompareTableRow[];
  /** The compared roast's header, e.g. its date and time. */
  otherTitle: string;
  className?: string;
}) {
  const titles: Record<(typeof VALUES)[number], string> = {
    own: 'This roast',
    other: otherTitle,
    diff: 'Difference',
  };
  return (
    <div className={cn('rounded-xl bg-surface p-4', className)}>
      <table aria-label="Comparison" className="w-full border-collapse text-label tabular-nums">
        <thead>
          <tr className="text-ink-muted">
            <th scope="col" className="pb-2 text-left font-medium">
              <span className="sr-only">Measure</span>
            </th>
            {VALUES.map((key) => (
              <th key={key} scope="col" className="pb-2 pl-4 text-right font-medium">
                {titles[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border text-ink">
              <th scope="row" className="py-2 text-left font-normal">
                {row.label}
              </th>
              {VALUES.map((key) => (
                <td key={key} className="py-2 pl-4 text-right">
                  {row.stars && key !== 'diff' ? (
                    <StarRating value={row[key] === undefined ? null : Number(row[key])} />
                  ) : (
                    (row[key] ?? (key === 'diff' ? '' : '–'))
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
