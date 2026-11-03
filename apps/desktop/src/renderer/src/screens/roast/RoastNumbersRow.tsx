import { formatClock, formatNumber, StatCard } from '@roastpilot/ui';
import type { RoastNumbers } from './roast-numbers';

const clock = (s: number | undefined) => (s === undefined ? undefined : formatClock(s));

/** BT, RoR, time since charge and development: numbers first (docs/spec/manual-mode.md). */
export function RoastNumbersRow({ numbers }: { numbers: RoastNumbers }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <StatCard
        label="Temperature"
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
      <StatCard label="Time" value={clock(numbers.elapsedS)} context="Since charge" />
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
