import type uPlot from 'uplot';
import { formatClock } from '../../lib/format';
import type { ChartColors } from './chart-colors';
import type { ChartAid, ChartMarker, LineLayer } from './chart-layer';
import {
  aidsTopC,
  drawBandLabels,
  drawNowLines,
  drawPhaseBands,
  drawProjections,
} from './draw-aids';
import { attachDrag, drawDragHandles, type ChartDrag, type TimeRange } from './drag-handles';
import { drawLatestDot, drawMarkers, markerLabelBoxes, markerLineBoxes } from './draw-markers';
import { hoverCursor } from './hover-cursor';
import {
  axisFactory,
  LEFT_AXIS_PX,
  noAxisGutter,
  RIGHT_AXIS_PX,
  series,
  SIDE,
} from './uplot-parts';
import {
  OUTPUT_RANGE,
  OUTPUT_TICKS,
  ROR_RANGE,
  temperatureRange,
  TIME_STEPS_S,
  xScale,
} from './scales';

interface CommonInput {
  width: number;
  height: number;
  /** This plot's layers only. */
  layers: readonly LineLayer[];
  /** Read at draw time, so new markers need a redraw, not a rebuild. */
  markers: () => readonly ChartMarker[];
  /** Read at draw time too: the now line, projection and phase bands. */
  aids: () => readonly ChartAid[];
  colors: ChartColors;
  /** Whether the chart has a RoR axis on the right; the strip keeps the same gutter. */
  rightAxis: boolean;
  /** The time under the pointer, or undefined when it leaves the plot. */
  onHover: (t: number | undefined) => void;
  /** Changes the time range that fits the data, read at draw time. */
  adjustTimeRange?: (fitted: TimeRange) => TimeRange;
}

export interface ChartOptionsInput extends CommonInput {
  /** Index of the layer that gets the current-point dot, if any. */
  latestDotLayer: number;
  /** Where the temperature axis starts, °C, read at draw time. */
  temperatureFloorC: () => number;
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

/** The temperature chart: °C on the left, RoR on the right, markers with labels. */
export function buildChartOptions({
  width,
  height,
  layers,
  markers,
  aids,
  latestDotLayer,
  temperatureFloorC,
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
      temperature: { range: temperatureRange(temperatureFloorC, () => aidsTopC(aids())) },
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
      // Behind the grid and every line.
      drawClear: [
        (u) => {
          drawPhaseBands(u, aids(), colors);
        },
      ],
      draw: [
        (u) => {
          // Band names first, clear of the markers' labels and lines.
          const shown = markers();
          drawBandLabels(
            u,
            aids(),
            { labels: markerLabelBoxes(u, shown, colors), lines: markerLineBoxes(u, shown) },
            colors,
          );
          drawMarkers(u, markers(), colors, { labels: true });
          drawProjections(u, aids(), colors);
          drawNowLines(u, aids(), colors);
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
  aids,
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
          drawNowLines(u, aids(), colors);
        },
      ],
    },
  };
}
