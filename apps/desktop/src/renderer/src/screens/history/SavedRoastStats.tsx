import type { RoastSummary } from '@roastpilot/shared';
import { formatClock, formatNumber, StatCard } from '@roastpilot/ui';

const clock = (s: number | null) => (s === null ? undefined : formatClock(s));

/** Total time, first crack, development and drop temperature of a saved roast. */
export function SavedRoastStats({ roast }: { roast: RoastSummary }) {
  const { fcTimeS, dropTimeS } = roast;
  const developmentS = fcTimeS !== null && dropTimeS !== null ? dropTimeS - fcTimeS : null;
  const share =
    developmentS !== null && dropTimeS !== null && dropTimeS > 0
      ? formatNumber((developmentS / dropTimeS) * 100, 0)
      : undefined;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard label="Total" value={clock(dropTimeS)} context="Charge to drop" />
      <StatCard label="First crack" value={clock(fcTimeS)} context="Since charge" />
      <StatCard
        label="Development"
        value={clock(developmentS)}
        context={share === undefined ? 'After first crack' : `${share}% of the roast`}
      />
      <StatCard
        label="Drop"
        value={formatNumber(roast.dropTemp, 1)}
        unit="°C"
        tone="heat"
        context="Bean temperature"
      />
    </div>
  );
}
