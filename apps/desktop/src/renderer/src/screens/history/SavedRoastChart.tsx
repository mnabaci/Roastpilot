import type { RoastDetail } from '@roastpilot/shared';
import { Button, cn, RoastChart } from '@roastpilot/ui';
import { useMemo } from 'react';
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
}: {
  detail: RoastDetail;
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
  const focus = useMemo(() => savedRoastFocus(detail), [detail]);
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
      layers={chart.layers}
      markers={chart.markers}
      timeWindow={showPreheat ? undefined : focus}
    />
  );
}
