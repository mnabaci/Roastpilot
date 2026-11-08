import {
  rateOfRise,
  ROR_DRAW_LIMITS,
  ROR_WINDOW_MS,
  rorReadings,
  smoothCurve,
} from '@roastpilot/core';
import {
  DEFAULT_TEMP_NAMES,
  type CurvePoint,
  type Reading,
  type RoastEvent,
  type RoastState,
} from '@roastpilot/shared';
import type { LineLayer, ChartMarker, ChartPoint } from '@roastpilot/ui';

/** Readings further apart than this are a break in every line (the lost-connection limit). */
export const GAP_MS = 3_000;

/** The dashed plan is the smooth curve Auto follows, drawn from a point every 5 s. */
export const PLAN_STEP_S = 5;

const MARKER_LABELS: Partial<Record<RoastEvent['kind'], string>> = {
  charge: 'Charge',
  'turning-point': 'TP',
  'dry-end': 'Dry end',
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
 * The readings the RoR line is drawn from: charge to drop (or Stop roast), as Artisan does. There
 * is no RoR line in preheat or cooling.
 */
function roastingReadings(roast: RoastState, readings: readonly Reading[]): readonly Reading[] {
  if (roast.chargedAtMs === null) return [];
  const endMs = roast.droppedAtMs ?? roast.events.find((e) => e.kind === 'end')?.atMs ?? Infinity;
  return rorReadings(readings, roast.chargedAtMs).filter((r) => r.atMs <= endMs);
}

/**
 * The readings the lines are drawn from: up to cool end (or Stop roast), as History saves them.
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
  {
    smoothingS,
    tempName = DEFAULT_TEMP_NAMES.name,
    plan,
  }: { smoothingS: number; tempName?: string; plan?: readonly CurvePoint[] | undefined },
): { layers: LineLayer[]; markers: ChartMarker[] } {
  const readings = untilRoastEnd(roast, allReadings);
  const zeroMs = roast.chargedAtMs ?? readings[0]?.atMs ?? 0;
  const toT = (atMs: number) => (atMs - zeroMs) / 1000;
  const breaks = breakTimes(readings).map(toT);
  const temperature: LineLayer = {
    id: 'bt',
    label: tempName,
    axis: 'temperature',
    tone: 'heat',
    width: 3.5,
    points: smoothed(withBreaks(channelPoints(readings, 'bt', toT), breaks), smoothingS),
  };
  const ror: LineLayer = {
    id: 'ror',
    label: 'RoR',
    axis: 'ror',
    tone: 'air',
    width: 2,
    points: withBreaks(rorPoints(roastingReadings(roast, readings), toT), breaks),
  };
  // The outputs strip (docs/spec/ui.md): what you set, as steps under the curve.
  const output = (id: string, label: string, tone: 'heat' | 'air' | 'neutral'): LineLayer => ({
    id,
    label,
    axis: 'output',
    tone,
    width: 2,
    step: true,
    points: withBreaks(channelPoints(readings, id, toT), breaks),
  });
  const drum = output('drum', 'Drum', 'neutral');
  const markers = roast.events.flatMap((event): ChartMarker[] => {
    const label = MARKER_LABELS[event.kind];
    return label ? [{ id: event.kind, label, t: toT(event.atMs), tone: 'ink' }] : [];
  });
  // Only from charge on: the plan's clock starts there, and the preheat's doesn't.
  const planned: LineLayer[] =
    plan && roast.chargedAtMs !== null
      ? [
          {
            id: 'plan',
            label: 'Plan',
            axis: 'temperature',
            tone: 'target',
            width: 2,
            dash: [6, 6],
            points: smoothCurve(plan, PLAN_STEP_S).map((point) => ({ t: point.tS, v: point.c })),
          },
        ]
      : [];
  return {
    layers: [
      ...planned,
      temperature,
      ror,
      output('heater', 'Heater', 'heat'),
      output('fan', 'Fan', 'air'),
      // A drum that only goes on and off reads 1 for on: drawn at 100%, like a full-speed drum.
      ...(drum.points.some((p) => p.v !== null) ? [onOffAsPercent(drum)] : []),
    ],
    markers,
  };
}

/** An on/off output (every value 0 or 1) on the 0–100% axis; a speed in % stays as it is. */
function onOffAsPercent(layer: LineLayer): LineLayer {
  const onOff = layer.points.every((p) => p.v === null || p.v === 0 || p.v === 1);
  return onOff
    ? { ...layer, points: layer.points.map((p) => (p.v === null ? p : { ...p, v: p.v * 100 })) }
    : layer;
}
