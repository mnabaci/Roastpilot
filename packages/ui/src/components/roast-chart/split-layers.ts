import type uPlot from 'uplot';
import { alignLayers } from './align-layers';
import {
  isLineLayer,
  type ChartAid,
  type ChartLayer,
  type ChartMarker,
  type LineLayer,
} from './chart-layer';
import type { Overlay } from './use-uplot';

export interface SplitLayers {
  /** Lines on the chart: temperature and RoR. */
  main: LineLayer[];
  /** Lines in the outputs strip. */
  strip: LineLayer[];
  mainData: uPlot.AlignedData;
  stripData: uPlot.AlignedData;
  mainOverlay: Overlay;
  stripOverlay: Overlay;
}

/**
 * What each plot draws: the chart gets temperature and RoR lines with every aid; the strip its
 * outputs and only the now line. Both share one set of times, so they line up.
 */
export function splitLayers(
  layers: readonly ChartLayer[],
  markers: readonly ChartMarker[],
): SplitLayers {
  const lines = layers.filter(isLineLayer);
  const aids = layers.filter((l): l is ChartAid => !isLineLayer(l));
  const main = lines.filter((l) => l.axis !== 'output');
  const strip = lines.filter((l) => l.axis === 'output');
  const { xs, series } = alignLayers([...main, ...strip]);
  return {
    main,
    strip,
    mainData: [xs, ...series.slice(0, main.length)] as uPlot.AlignedData,
    stripData: [xs, ...series.slice(main.length)] as uPlot.AlignedData,
    mainOverlay: { markers, aids },
    stripOverlay: { markers, aids: aids.filter((aid) => aid.kind === 'now-line') },
  };
}
