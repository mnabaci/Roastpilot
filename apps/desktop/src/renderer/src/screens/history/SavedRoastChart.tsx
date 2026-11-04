import type { RoastDetail } from '@roastpilot/shared';
import { RoastChart } from '@roastpilot/ui';
import { useMemo } from 'react';
import { savedRoastChart } from './saved-roast-chart';

/** A saved roast's chart, with another roast as a ghost line when one is picked. */
export function SavedRoastChart({
  detail,
  compare,
  compareLabel,
  smoothingS,
}: {
  detail: RoastDetail;
  compare: RoastDetail | undefined;
  compareLabel: string;
  smoothingS: number;
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
  return <RoastChart title="Roast curve" layers={chart.layers} markers={chart.markers} />;
}
