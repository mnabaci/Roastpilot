import type uPlot from 'uplot';
import type { ChartColors } from './chart-colors';
import type { LineLayer } from './chart-layer';

/** uPlot's `Axis.Side` is an ambient const enum, which isolated modules can't read at runtime. */
/* eslint-disable @typescript-eslint/no-unsafe-enum-assignment -- these are the enum's own values */
export const SIDE = {
  right: 1 as uPlot.Axis.Side,
  bottom: 2 as uPlot.Axis.Side,
  left: 3 as uPlot.Axis.Side,
};
/* eslint-enable @typescript-eslint/no-unsafe-enum-assignment */

/** Fixed axis gutters, so the chart and the outputs strip line up to the pixel. */
export const LEFT_AXIS_PX = 56;
export const RIGHT_AXIS_PX = 48;

export function axisFactory(colors: ChartColors) {
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

export function series(
  layers: readonly LineLayer[],
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
      ...(layer.opacity === undefined ? {} : { alpha: layer.opacity }),
      points: { show: false },
      // Joins across undefined (another layer's time), breaks at null (missing readings).
      spanGaps: false,
      ...(layer.step && stepped ? { paths: stepped } : {}),
    })),
  ];
}

/** With no RoR axis, both plots keep the same room for the last time label, so they still line up. */
const NO_AXIS_RIGHT_PX = 24;
export const noAxisGutter = (rightAxis: boolean): Pick<uPlot.Options, 'padding'> =>
  rightAxis ? {} : { padding: [null, NO_AXIS_RIGHT_PX, null, null] };
