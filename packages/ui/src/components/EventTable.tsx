import { cn } from '../lib/utils';

export interface EventRow {
  event: string;
  /** Formatted values with units; undefined shows a dash. */
  time: string | undefined;
  bt: string | undefined;
  ror: string | undefined;
  heater: string | undefined;
  fan: string | undefined;
}

const COLUMNS = [
  ['time', 'Time'],
  ['bt', 'BT'],
  ['ror', 'RoR'],
  ['heater', 'Heater'],
  ['fan', 'Fan'],
] as const;

/** A saved roast's events with the values at each (design system, EventTable). */
export function EventTable({ rows, className }: { rows: readonly EventRow[]; className?: string }) {
  return (
    <div className={cn('rounded-xl bg-surface p-4', className)}>
      <table aria-label="Events" className="w-full border-collapse text-label tabular-nums">
        <thead>
          <tr className="text-ink-muted">
            <th scope="col" className="pb-2 text-left font-medium">
              Event
            </th>
            {COLUMNS.map(([key, title]) => (
              <th key={key} scope="col" className="pb-2 text-right font-medium">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.event} className="border-t border-border text-ink">
              <th scope="row" className="py-2 text-left font-normal">
                {row.event}
              </th>
              {COLUMNS.map(([key]) => (
                <td key={key} className="py-2 text-right">
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
