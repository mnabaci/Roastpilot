import type { LineLayer } from './chart-layer';

export interface AlignedData {
  /** Every distinct time, ascending, in seconds. */
  xs: number[];
  /**
   * One array per layer, same order as the layers: undefined where a layer has no point at that
   * time (uPlot joins across it), null where the layer has a break (uPlot leaves a gap).
   */
  series: (number | null | undefined)[][];
}

/** uPlot needs one shared x axis: merges the layers' times and lines each layer up against it. */
export function alignLayers(layers: readonly LineLayer[]): AlignedData {
  const xs = [...new Set(layers.flatMap((layer) => layer.points.map((p) => p.t)))].sort(
    (a, b) => a - b,
  );
  const series = layers.map((layer) => {
    const byTime = new Map(layer.points.map((p) => [p.t, p.v]));
    return xs.map((x) => byTime.get(x));
  });
  return { xs, series };
}
