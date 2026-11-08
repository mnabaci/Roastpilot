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

/** A value with its unit, as the legend and the text alternative show it. */
export function formatLayerValue(axis: LineLayer['axis'], v: number): string {
  return {
    temperature: `${v.toFixed(1)} °C`,
    ror: `${v.toFixed(1)} °C/min`,
    output: `${String(Math.round(v))}%`,
  }[axis];
}
