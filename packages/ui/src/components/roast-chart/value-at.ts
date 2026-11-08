import { rorSymbol, tempSymbol, type TemperatureUnit } from '@roastpilot/shared';
import { formatNumber } from '../../lib/format';
import type { LineLayer } from './chart-layer';

/**
 * A layer's value at time `t`: the last point at or before it, held until the next one (outputs
 * change in steps; readings come every second). Undefined before the first point and in a break.
 */
export function valueAt(layer: LineLayer, t: number): number | undefined {
  const { points } = layer;
  let low = 0;
  let high = points.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if ((points[mid]?.t ?? Infinity) <= t) {
      found = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  return points[found]?.v ?? undefined;
}

/** A value with its unit, as the legend and the text alternative show it; °F temperatures whole. */
export function formatLayerValue(
  axis: LineLayer['axis'],
  v: number,
  unit: TemperatureUnit,
): string {
  if (axis === 'temperature') {
    return `${formatNumber(v, unit === 'f' ? 0 : 1) ?? '–'} ${tempSymbol(unit)}`;
  }
  if (axis === 'ror') return `${v.toFixed(1)} ${rorSymbol(unit)}`;
  return `${String(Math.round(v))}%`;
}
