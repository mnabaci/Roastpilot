import type { RoastDetail } from '@roastpilot/shared';
import { Button, cn, RoastChart, type ChartAid, type LineLayer } from '@roastpilot/ui';
import type { TimeSpan } from '../../features/roast-report/report-text';
import { useMemo } from 'react';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { savedRoastChart, savedRoastFocus } from './saved-roast-chart';

/**
 * A saved roast's chart, with another roast as a ghost line when one is picked. It opens on the
 * roast; Show preheat widens it to everything recorded (docs/spec/ui.md, History).
 */
export function SavedRoastChart({
  detail,
  compare,
  compareLabel,
  smoothingS,
  showPreheat,
  onShowPreheat,
  span,
}: {
  detail: RoastDetail;
  /** A stretch to pick out: the Roast report's finding you point at. */
  span?: TimeSpan | undefined;
  compare: RoastDetail | undefined;
  compareLabel: string;
  smoothingS: number;
  showPreheat: boolean;
  onShowPreheat: (show: boolean) => void;
}) {
  const chart = useMemo(
    () =>
      savedRoastChart(
        detail,
        compare ? { detail: compare, label: compareLabel } : undefined,
        smoothingS,
      ),
    [detail, compare, compareLabel, smoothingS],
  );
  const layers = useMemo(
    (): readonly (ChartAid | LineLayer)[] =>
      span ? [{ kind: 'time-span', id: 'finding', ...span }, ...chart.layers] : chart.layers,
    [chart.layers, span],
  );
  const focus = useMemo(() => savedRoastFocus(detail, compare), [detail, compare]);
  const unit = useTemperatureUnit();
  return (
    <RoastChart
      title="Roast curve"
      titleAction={
        focus ? (
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={showPreheat}
            className={cn(showPreheat && 'bg-heat-tint text-heat')}
            onClick={() => {
              onShowPreheat(!showPreheat);
            }}
          >
            Show preheat
          </Button>
        ) : undefined
      }
      layers={layers}
      markers={chart.markers}
      timeWindow={showPreheat ? undefined : focus}
      temperatureUnit={unit}
    />
  );
}
