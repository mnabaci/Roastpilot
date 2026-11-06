import type uPlot from 'uplot';
import { formatClock } from '../../lib/format';
import type { ChartColors } from './chart-colors';
import type { ChartLayer, ChartMarker } from './chart-layer';
import { attachDrag, drawDragHandles, type ChartDrag, type TimeRange } from './drag-handles';
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

/** The temperature axis is fixed at 0–250 °C (Artisan's default) and grows in 50 °C steps. */
export const TEMPERATURE_MAX_C = 250;
const TEMPERATURE_STEP_C = 50;
export const TEMPERATURE_RANGE: uPlot.Range.Function = (_u, _min, max) => [
  0,
  Number.isFinite(max) && max > TEMPERATURE_MAX_C
    ? Math.ceil(max / TEMPERATURE_STEP_C) * TEMPERATURE_STEP_C
    : TEMPERATURE_MAX_C,
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
  /** The time under the pointer, or undefined when it leaves the plot. */
  onHover: (t: number | undefined) => void;
  /** Changes the time range that fits the data, read at draw time. */
  adjustTimeRange?: (fitted: TimeRange) => TimeRange;
}

/** One vertical hover line across the chart and the strip, reporting the time under it. */
function hoverCursor(onHover: (t: number | undefined) => void): Pick<uPlot.Options, 'cursor'> & {
  hooks: { setCursor: uPlot.Hooks.Defs['setCursor'][] };
} {
  return {
    cursor: {
      x: true,
      y: false,
      points: { show: false },
      drag: { x: false, y: false, setScale: false },
      sync: { key: 'roast-chart' },
    },
    hooks: {
      setCursor: [
        (u) => {
          const left = u.cursor.left ?? -1;
          onHover(left >= 0 ? u.posToVal(left, 'x') : undefined);
        },
      ],
    },
  };
}

export interface ChartOptionsInput extends CommonInput {
  /** Index of the layer that gets the current-point dot, if any. */
  latestDotLayer: number;
  /** Moves the chart's draggable points. */
  dragging?: {
    drag: () => ChartDrag | undefined;
    onStart: (range: TimeRange) => void;
    onEnd: () => void;
  };
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
      // Joins across undefined (another layer's time), breaks at null (missing readings).
      spanGaps: false,
      ...(layer.step && stepped ? { paths: stepped } : {}),
    })),
  ];
}

const xScale = (adjust: ((fitted: TimeRange) => TimeRange) | undefined): uPlot.Scale => ({
  time: false,
  range: adjust
    ? (u, min, max, scale) => {
        const [from, to] = adjust(TIME_RANGE(u, min, max, scale) as [number, number]);
        return [from, to];
      }
    : TIME_RANGE,
});

/** With no RoR axis, both plots keep the same room for the last time label, so they still line up. */
const NO_AXIS_RIGHT_PX = 24;
const noAxisGutter = (rightAxis: boolean): Pick<uPlot.Options, 'padding'> =>
  rightAxis ? {} : { padding: [null, NO_AXIS_RIGHT_PX, null, null] };

/** The temperature chart: °C on the left, RoR on the right, markers with labels. */
export function buildChartOptions({
  width,
  height,
  layers,
  markers,
  latestDotLayer,
  colors,
  rightAxis,
  onHover,
  adjustTimeRange,
  dragging,
}: ChartOptionsInput): uPlot.Options {
  const axis = axisFactory(colors);
  const hover = hoverCursor(onHover);
  return {
    width,
    height,
    legend: { show: false },
    cursor: hover.cursor,
    ...noAxisGutter(rightAxis),
    scales: {
      x: xScale(adjustTimeRange),
      temperature: { range: TEMPERATURE_RANGE },
      ror: { range: ROR_RANGE },
    },
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
      ...hover.hooks,
      ...(dragging
        ? {
            ready: [
              (u: uPlot) => {
                attachDrag(u, dragging);
              },
            ],
          }
        : {}),
      draw: [
        (u) => {
          drawMarkers(u, markers(), colors, { labels: true });
          const layer = layers[latestDotLayer];
          if (layer) drawLatestDot(u, latestDotLayer + 1, layer, colors);
          drawDragHandles(u, dragging?.drag(), colors);
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
  onHover,
  adjustTimeRange,
}: StripOptionsInput): uPlot.Options {
  const axis = axisFactory(colors);
  const hover = hoverCursor(onHover);
  return {
    width,
    height,
    legend: { show: false },
    cursor: hover.cursor,
    ...noAxisGutter(rightAxis),
    scales: { x: xScale(adjustTimeRange), output: { range: OUTPUT_RANGE } },
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
      ...hover.hooks,
      draw: [
        (u) => {
          drawMarkers(u, markers(), colors, { labels: false });
        },
      ],
    },
  };
}
