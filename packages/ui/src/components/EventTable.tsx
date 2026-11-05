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

const KEYS = ['time', 'bt', 'ror', 'heater', 'fan'] as const;

/**
 * A saved roast's events with the values at each (design system, EventTable). `tempLabel` is the
 * roaster's short name for its temperature (`Temp`, or `BT` on a roaster with a bean probe).
 */
export function EventTable({
  rows,
  tempLabel = 'Temp',
  className,
}: {
  rows: readonly EventRow[];
  tempLabel?: string;
  className?: string;
}) {
  const titles: Record<(typeof KEYS)[number], string> = {
    time: 'Time',
    bt: tempLabel,
    ror: 'RoR',
    heater: 'Heater',
    fan: 'Fan',
  };
  return (
    <div className={cn('rounded-xl bg-surface p-4', className)}>
      <table aria-label="Events" className="w-full border-collapse text-label tabular-nums">
        <thead>
          <tr className="text-ink-muted">
            <th scope="col" className="pb-2 text-left font-medium">
              Event
            </th>
            {KEYS.map((key) => (
              <th key={key} scope="col" className="pb-2 text-right font-medium">
                {titles[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.event}-${row.time}`} className="border-t border-border text-ink">
              <th scope="row" className="py-2 text-left font-normal">
                {row.event}
              </th>
              {KEYS.map((key) => (
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
