import { ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

/** One output the coach would change: where it is now, and where it should go. */
export interface CoachChange {
  /** The output's name, e.g. "Heater" or "Fan". */
  name: string;
  /** Percent now. */
  from: number;
  /** Percent suggested. */
  to: number;
  /** `heat` for the heater, `air` for the fan: the target takes the colour of its slider. */
  tone: 'heat' | 'air';
}

/** The target's box takes its output's colour: the slider it will move. */
const TONE = { heat: 'border-heat text-heat', air: 'border-air text-air' } as const;

/** A value in its own box, so now and target read as values, not words in a sentence. */
const BOX = 'inline-block rounded-md border px-2.5';

const pct = (value: number) => `${String(Math.round(value))}%`;

/**
 * The suggested changes as aligned rows: name, now in a quiet outlined box, an arrow, the target in a box
 * in its output's colour. A real table, so the values line up and screen readers read each row
 * as "Heater from 75% to 65%".
 */
export function CoachChanges({ changes }: { changes: readonly CoachChange[] }) {
  return (
    <table className="self-start border-separate border-spacing-y-1 tabular-nums">
      <tbody>
        {changes.map((change) => (
          <tr key={change.name}>
            <th scope="row" className="pr-4 text-left text-label font-normal text-ink-muted">
              {change.name}
            </th>
            <td className="text-right">
              <span className={cn(BOX, 'border-border-strong text-body text-ink-muted')}>
                <span className="sr-only">from </span>
                {pct(change.from)}
              </span>
            </td>
            <td className="px-2 text-ink-muted" aria-hidden="true">
              <ArrowRight className="size-4" />
            </td>
            <td className="text-right">
              <span className={cn(BOX, 'bg-surface text-body font-semibold', TONE[change.tone])}>
                <span className="sr-only">to </span>
                {pct(change.to)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
