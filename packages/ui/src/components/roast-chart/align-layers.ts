import type { ChartLayer } from './chart-layer';

export interface AlignedData {
  /** Every distinct time, ascending, in seconds. */
  xs: number[];
  /** One array per layer, same order as the layers, null where a layer has no point. */
  series: (number | null)[][];
}

/** uPlot needs one shared x axis: merges the layers' times and lines each layer up against it. */
export function alignLayers(layers: readonly ChartLayer[]): AlignedData {
  const xs = [...new Set(layers.flatMap((layer) => layer.points.map((p) => p.t)))].sort(
    (a, b) => a - b,
  );
  const series = layers.map((layer) => {
    const byTime = new Map(layer.points.map((p) => [p.t, p.v]));
    return xs.map((x) => byTime.get(x) ?? null);
  });
  return { xs, series };
}
