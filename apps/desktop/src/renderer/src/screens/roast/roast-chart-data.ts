import { rorReadings, smoothCurve } from '@roastpilot/core';
import {
  DEFAULT_ET_NAMES,
  DEFAULT_TEMP_NAMES,
  type CurvePoint,
  type Reading,
  type RoastEvent,
  type RoastState,
} from '@roastpilot/shared';
import type { ChartMarker, ChartPoint, LineLayer } from '@roastpilot/ui';
import { breakTimes, channelPoints, rorPoints, smoothed, withBreaks } from './chart-series';

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

type ToT = (atMs: number) => number;

/** The bean temperature (as the roaster names it), and ET behind it where the roast recorded it. */
function temperatureLayers(
  readings: readonly Reading[],
  toT: ToT,
  breaks: readonly number[],
  { smoothingS, tempName, etShort }: { smoothingS: number; tempName: string; etShort: string },
): LineLayer[] {
  const line = (points: ChartPoint[]) => smoothed(withBreaks(points, breaks), smoothingS);
  const etPoints = channelPoints(readings, 'et', toT);
  const et: LineLayer[] =
    etPoints.length > 0
      ? [
          {
            id: 'et',
            label: etShort,
            axis: 'temperature',
            tone: 'env',
            width: 2,
            points: line(etPoints),
          },
        ]
      : [];
  const bt: LineLayer = {
    id: 'bt',
    label: tempName,
    axis: 'temperature',
    tone: 'heat',
    width: 3.5,
    points: line(channelPoints(readings, 'bt', toT)),
  };
  return [...et, bt];
}

/** The outputs strip (docs/spec/ui.md): what you set, as steps under the curve. */
function outputLayers(
  readings: readonly Reading[],
  toT: ToT,
  breaks: readonly number[],
): LineLayer[] {
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
  return [
    output('heater', 'Heater', 'heat'),
    output('fan', 'Fan', 'air'),
    // A drum that only goes on and off reads 1 for on: drawn at 100%, like a full-speed drum.
    ...(drum.points.some((p) => p.v !== null) ? [onOffAsPercent(drum)] : []),
  ];
}

/** The dashed plan, only from charge on: the plan's clock starts there, and the preheat's doesn't. */
function planLayers(roast: RoastState, plan: readonly CurvePoint[] | undefined): LineLayer[] {
  if (!plan || roast.chargedAtMs === null) return [];
  return [
    {
      id: 'plan',
      label: 'Plan',
      axis: 'temperature',
      tone: 'target',
      width: 2,
      dash: [6, 6],
      points: smoothCurve(plan, PLAN_STEP_S).map((point) => ({ t: point.tS, v: point.c })),
    },
  ];
}

/**
 * Temperature (as the roaster names it), ET where it was recorded, RoR, heater and fan layers plus
 * event markers, in seconds since charge (or since the first reading). Missing readings are breaks;
 * the temperature lines are smoothed.
 */
export function roastChartData(
  roast: RoastState,
  allReadings: readonly Reading[],
  {
    smoothingS,
    tempName = DEFAULT_TEMP_NAMES.name,
    etShort = DEFAULT_ET_NAMES.short,
    plan,
  }: {
    smoothingS: number;
    tempName?: string;
    etShort?: string;
    plan?: readonly CurvePoint[] | undefined;
  },
): { layers: LineLayer[]; markers: ChartMarker[] } {
  const readings = untilRoastEnd(roast, allReadings);
  const zeroMs = roast.chargedAtMs ?? readings[0]?.atMs ?? 0;
  const toT = (atMs: number) => (atMs - zeroMs) / 1000;
  const breaks = breakTimes(readings).map(toT);
  const ror: LineLayer = {
    id: 'ror',
    label: 'RoR',
    axis: 'ror',
    tone: 'air',
    width: 2,
    points: withBreaks(rorPoints(roastingReadings(roast, readings), toT), breaks),
  };
  const markers = roast.events.flatMap((event): ChartMarker[] => {
    const label = MARKER_LABELS[event.kind];
    return label ? [{ id: event.kind, label, t: toT(event.atMs), tone: 'ink' }] : [];
  });
  return {
    layers: [
      ...planLayers(roast, plan),
      ...temperatureLayers(readings, toT, breaks, { smoothingS, tempName, etShort }),
      ror,
      ...outputLayers(readings, toT, breaks),
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
