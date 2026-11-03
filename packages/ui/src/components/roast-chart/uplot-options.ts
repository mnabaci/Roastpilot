import type uPlot from 'uplot';
import { formatClock } from '../../lib/format';
import type { ChartColors } from './chart-colors';
import type { ChartLayer, ChartMarker } from './chart-layer';
import { drawLatestDot, drawMarkers } from './draw-markers';

/** uPlot's `Axis.Side` is an ambient const enum, which isolated modules can't read at runtime. */
/* eslint-disable @typescript-eslint/no-unsafe-enum-assignment -- these are the enum's own values */
const SIDE = {
  right: 1 as uPlot.Axis.Side,
  bottom: 2 as uPlot.Axis.Side,
  left: 3 as uPlot.Axis.Side,
};
/* eslint-enable @typescript-eslint/no-unsafe-enum-assignment */

/** Fixed axis gutters, so the chart and the outputs strip line up to the pixel. */
const LEFT_AXIS_PX = 56;
const RIGHT_AXIS_PX = 48;

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

/** RoR's right axis shows at least 0–30 °C/min (design system), widened when RoR goes outside. */
const ROR_RANGE: uPlot.Range.Function = (_u, min, max) => [
  Math.min(0, Math.floor(min)),
  Math.max(30, Math.ceil(max)),
];

/** Outputs run 0–100 %; a little headroom keeps a line at 100 % from being cut in half. */
const OUTPUT_RANGE: uPlot.Range.MinMax = [-4, 104];
const OUTPUT_TICKS = [0, 50, 100];

interface CommonInput {
  width: number;
  height: number;
  /** This plot's layers only. */
  layers: readonly ChartLayer[];
  /** Read at draw time, so new markers need a redraw, not a rebuild. */
  markers: () => readonly ChartMarker[];
  colors: ChartColors;
  /** Whether the chart has a RoR axis on the right; the strip keeps the same gutter. */
  rightAxis: boolean;
}

export interface ChartOptionsInput extends CommonInput {
  /** Index of the layer that gets the current-point dot, if any. */
  latestDotLayer: number;
}

export interface StripOptionsInput extends CommonInput {
  /** uPlot's stepped path builder (`uPlot.paths.stepped`), passed in so this file stays type-only. */
  stepped: uPlot.Series.PathBuilder | undefined;
}

function axisFactory(colors: ChartColors) {
  return (
    scale: string,
    side: uPlot.Axis.Side,
    values: uPlot.Axis['values'],
    showGrid: boolean,
  ): uPlot.Axis => ({
    scale,
    side,
    stroke: colors.axis,
    font: `13px ${colors.font}`,
    values,
    grid: { show: showGrid, stroke: colors.grid, width: 1 },
    ticks: { show: false },
  });
}

function series(
  layers: readonly ChartLayer[],
  colors: ChartColors,
  stepped?: uPlot.Series.PathBuilder,
): uPlot.Series[] {
  return [
    {},
    ...layers.map((layer) => ({
      label: layer.label,
      scale: layer.axis,
      stroke: colors.tone[layer.tone],
      width: layer.width,
      dash: layer.dash ? [...layer.dash] : undefined,
      points: { show: false },
      spanGaps: true,
      ...(layer.step && stepped ? { paths: stepped } : {}),
    })),
  ];
}

const xScale: uPlot.Scale = { time: false, range: TIME_RANGE };

/** The temperature chart: °C on the left, RoR on the right, markers with labels. */
export function buildChartOptions({
  width,
  height,
  layers,
  markers,
  latestDotLayer,
  colors,
  rightAxis,
}: ChartOptionsInput): uPlot.Options {
  const axis = axisFactory(colors);
  return {
    width,
    height,
    legend: { show: false },
    cursor: { show: false },
    scales: { x: xScale, temperature: { auto: true }, ror: { range: ROR_RANGE } },
    axes: [
      {
        ...axis('x', SIDE.bottom, (_u, ticks) => ticks.map(formatClock), true),
        incrs: TIME_STEPS_S,
      },
      {
        ...axis('temperature', SIDE.left, (_u, ticks) => ticks.map(String), true),
        size: LEFT_AXIS_PX,
      },
      ...(rightAxis
        ? [
            {
              ...axis('ror', SIDE.right, (_u, ticks) => ticks.map(String), false),
              size: RIGHT_AXIS_PX,
            },
          ]
        : []),
    ],
    series: series(layers, colors),
    hooks: {
      draw: [
        (u) => {
          drawMarkers(u, markers(), colors, { labels: true });
          const layer = layers[latestDotLayer];
          if (layer) drawLatestDot(u, latestDotLayer + 1, layer, colors);
        },
      ],
    },
  };
}

/** The outputs strip under the chart (design system: RoastChart, Outputs strip). */
export function buildStripOptions({
  width,
  height,
  layers,
  markers,
  colors,
  rightAxis,
  stepped,
}: StripOptionsInput): uPlot.Options {
  const axis = axisFactory(colors);
  return {
    width,
    height,
    legend: { show: false },
    cursor: { show: false },
    scales: { x: xScale, output: { range: OUTPUT_RANGE } },
    axes: [
      // Same time scale as the chart above; its labels are the chart's.
      { scale: 'x', show: false },
      {
        ...axis('output', SIDE.left, (_u, ticks) => ticks.map((t) => `${String(t)}%`), true),
        size: LEFT_AXIS_PX,
        splits: () => OUTPUT_TICKS,
      },
      ...(rightAxis
        ? [{ ...axis('output', SIDE.right, () => [], false), size: RIGHT_AXIS_PX }]
        : []),
    ],
    series: series(layers, colors, stepped),
    hooks: {
      draw: [
        (u) => {
          drawMarkers(u, markers(), colors, { labels: false });
        },
      ],
    },
  };
}
