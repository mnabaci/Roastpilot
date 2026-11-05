import { rateOfRise, ROR_DRAW_LIMITS, ROR_WINDOW_MS, rorReadings } from '@roastpilot/core';
import {
  DEFAULT_TEMP_NAMES,
  type Reading,
  type RoastEvent,
  type RoastState,
} from '@roastpilot/shared';
import type { ChartLayer, ChartMarker, ChartPoint } from '@roastpilot/ui';

/** Readings further apart than this are a break in every line (the lost-connection limit). */
export const GAP_MS = 3_000;

const MARKER_LABELS: Partial<Record<RoastEvent['kind'], string>> = {
  charge: 'Charge',
  'turning-point': 'TP',
  'first-crack': 'First crack',
  drop: 'Drop',
  end: 'End',
};

/** A channel's value at each reading that has it. */
function channelPoints(
  readings: readonly Reading[],
  channel: string,
  toT: (atMs: number) => number,
): ChartPoint[] {
  return readings.flatMap((r) => {
    const v = r.values[channel];
    return v === undefined ? [] : [{ t: toT(r.atMs), v }];
  });
}

/** Times of the breaks: halfway between readings more than GAP_MS apart. */
function breakTimes(readings: readonly Reading[]): number[] {
  return readings.flatMap((r, i) => {
    const previous = readings[i - 1];
    return previous && r.atMs - previous.atMs > GAP_MS ? [(previous.atMs + r.atMs) / 2] : [];
  });
}

/** Adds a null point at each break, so the line stops there instead of joining across it. */
function withBreaks(points: ChartPoint[], breaks: readonly number[]): ChartPoint[] {
  if (breaks.length === 0) return points;
  return [...points, ...breaks.map((t) => ({ t, v: null }))].sort((a, b) => a.t - b.t);
}

/**
 * The drawn temperature: a weighted average of the readings in the last `windowS` seconds, newest
 * counting most (weights 1, 2, 3, …), restarting after a break. Like Artisan's curve filter, it
 * smooths jitter with about half the lag of a plain average. 0 draws the raw readings
 * (docs/spec/ui.md, Temperature axis).
 */
function smoothed(points: readonly ChartPoint[], windowS: number): ChartPoint[] {
  if (windowS <= 0) return [...points];
  let start = 0;
  return points.map((point, i) => {
    if (point.v === null) {
      start = i + 1;
      return point;
    }
    while (start < i && (points[start]?.t ?? Infinity) <= point.t - windowS) start++;
    let sum = 0;
    let weights = 0;
    for (let k = start; k <= i; k++) {
      const weight = k - start + 1;
      sum += (points[k]?.v ?? 0) * weight;
      weights += weight;
    }
    return { t: point.t, v: sum / weights };
  });
}

/** RoR at each reading, from only the readings in its window, so the series stays O(n). */
function rorPoints(readings: readonly Reading[], toT: (atMs: number) => number): ChartPoint[] {
  const points: ChartPoint[] = [];
  let start = 0;
  readings.forEach((reading, i) => {
    while ((readings[start]?.atMs ?? Infinity) < reading.atMs - ROR_WINDOW_MS) start++;
    const ror = rateOfRise(readings.slice(start, i + 1));
    if (ror === undefined) return;
    // Outside the limits is a gap, not a spike that stretches the axis.
    const shown = ror >= ROR_DRAW_LIMITS.min && ror <= ROR_DRAW_LIMITS.max;
    points.push({ t: toT(reading.atMs), v: shown ? ror : null });
  });
  return points;
}

/**
 * The readings the RoR line is drawn from: charge to drop (or End roast), as Artisan does. There
 * is no RoR line in preheat or cooling.
 */
function roastingReadings(roast: RoastState, readings: readonly Reading[]): readonly Reading[] {
  if (roast.chargedAtMs === null) return [];
  const endMs = roast.droppedAtMs ?? roast.events.find((e) => e.kind === 'end')?.atMs ?? Infinity;
  return rorReadings(readings, roast.chargedAtMs).filter((r) => r.atMs <= endMs);
}

/**
 * The readings the lines are drawn from: up to cool end (or End roast), as History saves them.
 * After that only the BT number stays live (docs/spec/ui.md, Chart).
 */
function untilRoastEnd(roast: RoastState, readings: readonly Reading[]): readonly Reading[] {
  const ended = roast.events.find((e) => e.kind === 'cool-end' || e.kind === 'end');
  return ended ? readings.filter((r) => r.atMs <= ended.atMs) : readings;
}

/**
 * Temperature (as the roaster names it), RoR, heater and fan layers plus event markers, in seconds since charge (or
 * since the first reading). Missing readings are breaks; the temperature line is smoothed.
 */
export function roastChartData(
  roast: RoastState,
  allReadings: readonly Reading[],
  { smoothingS, tempName = DEFAULT_TEMP_NAMES.name }: { smoothingS: number; tempName?: string },
): { layers: ChartLayer[]; markers: ChartMarker[] } {
  const readings = untilRoastEnd(roast, allReadings);
  const zeroMs = roast.chargedAtMs ?? readings[0]?.atMs ?? 0;
  const toT = (atMs: number) => (atMs - zeroMs) / 1000;
  const breaks = breakTimes(readings).map(toT);
  const temperature: ChartLayer = {
    id: 'bt',
    label: tempName,
    axis: 'temperature',
    tone: 'heat',
    width: 3.5,
    points: smoothed(withBreaks(channelPoints(readings, 'bt', toT), breaks), smoothingS),
  };
  const ror: ChartLayer = {
    id: 'ror',
    label: 'RoR',
    axis: 'ror',
    tone: 'air',
    width: 2,
    points: withBreaks(rorPoints(roastingReadings(roast, readings), toT), breaks),
  };
  // The outputs strip (docs/spec/ui.md): what you set, as steps under the curve.
  const output = (id: string, label: string, tone: 'heat' | 'air'): ChartLayer => ({
    id,
    label,
    axis: 'output',
    tone,
    width: 2,
    step: true,
    points: withBreaks(channelPoints(readings, id, toT), breaks),
  });
  const markers = roast.events.flatMap((event): ChartMarker[] => {
    const label = MARKER_LABELS[event.kind];
    return label ? [{ id: event.kind, label, t: toT(event.atMs), tone: 'ink' }] : [];
  });
  return {
    layers: [temperature, ror, output('heater', 'Heater', 'heat'), output('fan', 'Fan', 'air')],
    markers,
  };
}
