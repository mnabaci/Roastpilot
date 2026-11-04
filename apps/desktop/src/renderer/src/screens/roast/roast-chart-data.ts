import { rateOfRise, ROR_WINDOW_MS } from '@roastpilot/core';
import type { Reading, RoastEvent, RoastState } from '@roastpilot/shared';
import type { ChartLayer, ChartMarker, ChartPoint } from '@roastpilot/ui';

/** Readings further apart than this are a break in every line (the lost-connection limit). */
export const GAP_MS = 3_000;

const MARKER_LABELS: Partial<Record<RoastEvent['kind'], string>> = {
  charge: 'Charge',
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
 * The drawn temperature: a moving average over the last `windowS` seconds, restarting after a
 * break. 0 draws the raw readings (docs/spec/ui.md, Temperature axis).
 */
function smoothed(points: readonly ChartPoint[], windowS: number): ChartPoint[] {
  if (windowS <= 0) return [...points];
  const out: ChartPoint[] = [];
  let start = 0;
  let sum = 0;
  points.forEach((point, i) => {
    if (point.v === null) {
      out.push(point);
      start = i + 1;
      sum = 0;
      return;
    }
    sum += point.v;
    while (start < i && (points[start]?.t ?? Infinity) <= point.t - windowS) {
      sum -= points[start]?.v ?? 0;
      start++;
    }
    out.push({ t: point.t, v: sum / (i - start + 1) });
  });
  return out;
}

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

/**
 * Bean temperature, RoR, heater and fan layers plus event markers, in seconds since charge (or
 * since the first reading). Missing readings are breaks; the temperature line is smoothed.
 */
export function roastChartData(
  roast: RoastState,
  readings: readonly Reading[],
  { smoothingS }: { smoothingS: number },
): { layers: ChartLayer[]; markers: ChartMarker[] } {
  const zeroMs = roast.chargedAtMs ?? readings[0]?.atMs ?? 0;
  const toT = (atMs: number) => (atMs - zeroMs) / 1000;
  const breaks = breakTimes(readings).map(toT);
  const temperature: ChartLayer = {
    id: 'bt',
    label: 'Temperature',
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
    points: withBreaks(rorPoints(readings, toT), breaks),
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
