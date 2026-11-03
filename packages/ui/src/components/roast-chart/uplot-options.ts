import type uPlot from 'uplot';
import { formatClock } from '../../lib/format';
import type { ChartColors } from './chart-colors';
import type { ChartLayer, ChartMarker } from './chart-layer';
import { drawLatestDot, drawMarkers } from './draw-markers';

/** RoR's right axis shows at least 0–30 °C/min (design system), widened when RoR goes outside. */
/** uPlot's `Axis.Side` is an ambient const enum, which isolated modules can't read at runtime. */
/* eslint-disable @typescript-eslint/no-unsafe-enum-assignment -- these are the enum's own values */
const SIDE = {
  right: 1 as uPlot.Axis.Side,
  bottom: 2 as uPlot.Axis.Side,
  left: 3 as uPlot.Axis.Side,
};
/* eslint-enable @typescript-eslint/no-unsafe-enum-assignment */

/** Time ticks land on whole steps (10 s up to 10 min), so labels never repeat. */
export const TIME_STEPS_S = [10, 15, 30, 60, 120, 300, 600];
/** At least a minute of time is shown, so the first seconds of a roast don't fill the width. */
export const MIN_TIME_SPAN_S = 60;

export const TIME_RANGE: uPlot.Range.Function = (_u, min, max) => {
  // uPlot passes null-ish bounds before there is any data.
  const start = Number.isFinite(min) ? Math.floor(min) : 0;
  const end = Number.isFinite(max) ? Math.ceil(max) : start;
  return [start, Math.max(end, start + MIN_TIME_SPAN_S)];
};

const ROR_RANGE: uPlot.Range.Function = (_u, min, max) => [
  Math.min(0, Math.floor(min)),
  Math.max(30, Math.ceil(max)),
];

export interface ChartOptionsInput {
  width: number;
  height: number;
  layers: readonly ChartLayer[];
  /** Read at draw time, so new markers need a redraw, not a rebuild. */
  markers: () => readonly ChartMarker[];
  /** Index of the layer that gets the current-point dot, if any. */
  latestDotLayer: number;
  colors: ChartColors;
}

export function buildChartOptions({
  width,
  height,
  layers,
  markers,
  latestDotLayer,
  colors,
}: ChartOptionsInput): uPlot.Options {
  const axisFont = `13px ${colors.font}`;
  const axis = (
    scale: string,
    side: uPlot.Axis.Side,
    values: uPlot.Axis['values'],
    showGrid: boolean,
  ): uPlot.Axis => ({
    scale,
    side,
    stroke: colors.axis,
    font: axisFont,
    values,
    grid: { show: showGrid, stroke: colors.grid, width: 1 },
    ticks: { show: false },
  });
  const hasRor = layers.some((l) => l.axis === 'ror');
  return {
    width,
    height,
    legend: { show: false },
    cursor: { show: false },
    scales: {
      x: { time: false, range: TIME_RANGE },
      temperature: { auto: true },
      ror: { range: ROR_RANGE },
    },
    axes: [
      {
        ...axis('x', SIDE.bottom, (_u, ticks) => ticks.map(formatClock), true),
        incrs: TIME_STEPS_S,
      },
      axis('temperature', SIDE.left, (_u, ticks) => ticks.map(String), true),
      ...(hasRor ? [axis('ror', SIDE.right, (_u, ticks) => ticks.map(String), false)] : []),
    ],
    series: [
      {},
      ...layers.map((layer) => ({
        label: layer.label,
        scale: layer.axis,
        stroke: colors.tone[layer.tone],
        width: layer.width,
        dash: layer.dash ? [...layer.dash] : undefined,
        points: { show: false },
        spanGaps: true,
      })),
    ],
    hooks: {
      draw: [
        (u) => {
          drawMarkers(u, markers(), colors);
          const layer = layers[latestDotLayer];
          if (layer) drawLatestDot(u, latestDotLayer + 1, layer, colors);
        },
      ],
    },
  };
}
