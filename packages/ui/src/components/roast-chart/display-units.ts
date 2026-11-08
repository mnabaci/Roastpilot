import { diffToUnit, fromUnit, toUnit, type TemperatureUnit } from '@roastpilot/shared';
import type { ChartLayer, ChartPoint, LineLayer } from './chart-layer';
import type { ChartDrag } from './drag-handles';

// The chart takes °C and converts at its door: everything inside draws in the unit shown
// (docs/spec/ui.md, Units).

/** A value on `axis` in the unit: a temperature with + 32, a RoR (a difference) without. */
const valueIn = (axis: LineLayer['axis'], v: number, unit: TemperatureUnit): number => {
  if (axis === 'temperature') return toUnit(v, unit);
  if (axis === 'ror') return diffToUnit(v, unit);
  return v;
};

const pointsIn = (
  axis: LineLayer['axis'],
  points: readonly ChartPoint[],
  unit: TemperatureUnit,
): ChartPoint[] => points.map((p) => (p.v === null ? p : { t: p.t, v: valueIn(axis, p.v, unit) }));

const layerIn = (layer: ChartLayer, unit: TemperatureUnit): ChartLayer => {
  switch (layer.kind) {
    case 'now-line':
      return layer;
    case 'phase-bands':
      return {
        ...layer,
        bands: layer.bands.map((band) => ({
          ...band,
          ...(band.fromC === undefined ? {} : { fromC: toUnit(band.fromC, unit) }),
          ...(band.toC === undefined ? {} : { toC: toUnit(band.toC, unit) }),
        })),
      };
    default:
      return { ...layer, points: pointsIn(layer.axis, layer.points, unit) };
  }
};

/** The layers, given in °C, in the unit shown; °C passes through untouched. */
export function layersInUnit(
  layers: readonly ChartLayer[],
  unit: TemperatureUnit,
): readonly ChartLayer[] {
  return unit === 'c' ? layers : layers.map((layer) => layerIn(layer, unit));
}

/** Draggable points shown in the unit; a move goes back in °C, to 0.1. */
export function dragInUnit(
  drag: ChartDrag | undefined,
  unit: TemperatureUnit,
): ChartDrag | undefined {
  if (!drag || unit === 'c') return drag;
  return {
    points: drag.points.map((p) => ({ t: p.t, v: toUnit(p.v, unit) })),
    onMove: (index, to) => {
      drag.onMove(index, { t: to.t, v: fromUnit(to.v, unit) });
    },
  };
}

/** The axis floor, given in °C, in the unit; rounded so 37.8 °C is 100 °F, not 99.999…. */
export const floorInUnit = (floorC: number, unit: TemperatureUnit): number =>
  Math.round(toUnit(floorC, unit) * 1e6) / 1e6;
