import { formatClock, formatNumber, StatCard } from '@roastpilot/ui';
import type { RoastNumbers } from './roast-numbers';

// A time that isn't a finite number shows a dash, never NaN:NaN.
const clock = (s: number | undefined) =>
  s === undefined || !Number.isFinite(s) ? undefined : formatClock(s);

/** Temperature, RoR, time (in preheat, then since charge) and development: numbers first (docs/spec/manual-mode.md). */
export function RoastNumbersRow({
  numbers,
  tempName,
}: {
  numbers: RoastNumbers;
  /** The connected roaster's name for its temperature. */
  tempName: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard
        label={tempName}
        value={numbers.bt === undefined ? undefined : formatNumber(numbers.bt, 1)}
        unit="°C"
        tone="heat"
      />
      <StatCard
        label="RoR"
        value={numbers.ror === undefined ? undefined : formatNumber(numbers.ror, 1)}
        unit="°C/min"
        tone="air"
      />
      <StatCard
        label="Time"
        value={clock(numbers.elapsedS ?? numbers.preheatS)}
        context={
          numbers.elapsedS === undefined && numbers.preheatS !== undefined
            ? 'In preheat'
            : 'Since charge'
        }
      />
      <StatCard
        label="Development"
        value={clock(numbers.developmentS)}
        context={
          numbers.developmentPct === undefined
            ? 'After first crack'
            : `${formatNumber(numbers.developmentPct, 0)}% of the roast`
        }
      />
    </div>
  );
}
