import type uPlot from 'uplot';
import type { Box } from './band-labels';
import type { ChartColors } from './chart-colors';
import type { LineLayer } from './chart-layer';
import { plotPixelRatio } from './pixel-ratio';

const DOT_RADIUS = 6;
const DOT_RING = 3;
/** Room kept between a marker label and the dot. */
const DOT_CLEARANCE = 2;

/** Where the live temperature's current point is on the canvas, if it is in view. */
function latestPoint(
  u: uPlot,
  seriesIndex: number,
  layer: LineLayer,
): { x: number; y: number } | undefined {
  const values = u.data[seriesIndex];
  if (!values) return undefined;
  let i = values.length - 1;
  while (i >= 0 && (values[i] === null || values[i] === undefined)) i--;
  const value = values[i];
  const t = u.data[0][i];
  if (i < 0 || value === null || value === undefined || t === undefined) return undefined;
  const x = u.valToPos(t, 'x', true);
  // Past a time window's edge (History focused on a roast still cooling): no dot in the gutter.
  if (x < u.bbox.left || x > u.bbox.left + u.bbox.width) return undefined;
  return { x, y: u.valToPos(value, layer.axis, true) };
}

/** The box the current-point dot and its ring take, plus a little room; none when out of view. */
export function latestDotClearance(u: uPlot, seriesIndex: number, layer: LineLayer): Box[] {
  const point = latestPoint(u, seriesIndex, layer);
  if (!point) return [];
  const reach = (DOT_RADIUS + DOT_RING / 2 + DOT_CLEARANCE) * plotPixelRatio(u);
  return [
    {
      left: point.x - reach,
      right: point.x + reach,
      top: point.y - reach,
      bottom: point.y + reach,
    },
  ];
}

/** The live temperature's current point: a 6px dot ringed in the surface colour. */
export function drawLatestDot(
  u: uPlot,
  seriesIndex: number,
  layer: LineLayer,
  colors: ChartColors,
): void {
  const point = latestPoint(u, seriesIndex, layer);
  if (!point) return;
  const ratio = plotPixelRatio(u);
  const { ctx } = u;
  ctx.save();
  ctx.beginPath();
  ctx.arc(point.x, point.y, DOT_RADIUS * ratio, 0, Math.PI * 2);
  ctx.fillStyle = colors.tone[layer.tone];
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = DOT_RING * ratio;
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}
