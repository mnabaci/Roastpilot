import { rateOfRise, ROR_WINDOW_MS } from '@roastpilot/core';
import type { Reading, RoastEvent, RoastState } from '@roastpilot/shared';
import type { ChartLayer, ChartMarker, ChartPoint } from '@roastpilot/ui';

const MARKER_LABELS: Partial<Record<RoastEvent['kind'], string>> = {
  charge: 'Charge',
  'first-crack': 'First crack',
  drop: 'Drop',
};

/** RoR at each reading, from only the readings in its window, so the series stays O(n). */
function rorPoints(readings: readonly Reading[], toT: (atMs: number) => number): ChartPoint[] {
  const points: ChartPoint[] = [];
  let start = 0;
  readings.forEach((reading, i) => {
    while ((readings[start]?.atMs ?? Infinity) < reading.atMs - ROR_WINDOW_MS) start++;
    const ror = rateOfRise(readings.slice(start, i + 1));
    if (ror !== undefined) points.push({ t: toT(reading.atMs), v: ror });
  });
  return points;
}

/** Bean temperature and RoR layers plus event markers, in seconds since charge (or since the first reading). */
export function roastChartData(
  roast: RoastState,
  readings: readonly Reading[],
): { layers: ChartLayer[]; markers: ChartMarker[] } {
  const zeroMs = roast.chargedAtMs ?? readings[0]?.atMs ?? 0;
  const toT = (atMs: number) => (atMs - zeroMs) / 1000;
  const temperature: ChartLayer = {
    id: 'bt',
    label: 'Temperature',
    axis: 'temperature',
    tone: 'heat',
    width: 3.5,
    points: readings.flatMap((r) => {
      const bt = r.values.bt;
      return bt === undefined ? [] : [{ t: toT(r.atMs), v: bt }];
    }),
  };
  const ror: ChartLayer = {
    id: 'ror',
    label: 'RoR',
    axis: 'ror',
    tone: 'air',
    width: 2,
    points: rorPoints(readings, toT),
  };
  const markers = roast.events.flatMap((event): ChartMarker[] => {
    const label = MARKER_LABELS[event.kind];
    return label ? [{ id: event.kind, label, t: toT(event.atMs), tone: 'ink' }] : [];
  });
  return { layers: [temperature, ror], markers };
}
