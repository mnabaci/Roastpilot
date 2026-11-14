import { diffNumber, rorSymbol, tempNumber, tempSymbol } from '@roastpilot/shared';
import { formatClock, formatNumber, StatCard } from '@roastpilot/ui';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import type { RoastNumbers } from './roast-numbers';

// A time that isn't a finite number shows a dash, never NaN:NaN.
const clock = (s: number | undefined) =>
  s === undefined || !Number.isFinite(s) ? undefined : formatClock(s);

/** Temperature (with ET beside it where there is one), RoR, time (in preheat, then since charge) and development: numbers first (docs/spec/manual-mode.md). */
export function RoastNumbersRow({
  numbers,
  tempName,
  etShort,
  tempLine,
  rorLine,
}: {
  numbers: RoastNumbers;
  /** The connected roaster's name for its temperature. */
  tempName: string;
  /** Its short name for ET, on a roaster with an ET probe: shown beside the temperature. */
  etShort?: string | undefined;
  /** How today compares with the plan in Auto, or else with the ghost. */
  tempLine?: string | undefined;
  /** The RoR the running Auto step aims for. */
  rorLine?: string | undefined;
}) {
  const unit = useTemperatureUnit();
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatCard
        label={tempName}
        value={numbers.bt === undefined ? undefined : tempNumber(numbers.bt, unit, 1)}
        unit={tempSymbol(unit)}
        tone="heat"
        {...(tempLine ? { context: tempLine } : {})}
        {...(etShort
          ? {
              secondary: {
                label: etShort,
                value: numbers.et === undefined ? undefined : tempNumber(numbers.et, unit, 1),
                // No unit: the big number beside it says it, and the card stays narrow enough.
                tone: 'env' as const,
              },
            }
          : {})}
      />
      <StatCard
        label="RoR"
        // A rate: × 1.8 in °F, never + 32.
        value={numbers.ror === undefined ? undefined : diffNumber(numbers.ror, unit, 1)}
        unit={rorSymbol(unit)}
        tone="air"
        // Every card has its line under the value: the aim in Auto, else what the rate is over.
        context={rorLine ?? 'Last 30 s'}
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
