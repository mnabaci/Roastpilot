import type uPlot from 'uplot';
import type { ChartColors } from './chart-colors';
import type { Box } from './band-labels';
import type { LineLayer, ChartMarker } from './chart-layer';

const LABEL_GAP = 8;
const LINE_HEIGHT = 18;

/**
 * Label rows, one per marker in time order: a label goes to the first row where it doesn't
 * run into the label before it, so close events (first crack, then drop) never overlap.
 */
export function labelRows(labels: readonly { x: number; width: number }[], gap: number): number[] {
  const rowEnds: number[] = [];
  return labels.map(({ x, width }) => {
    let row = rowEnds.findIndex((end) => x >= end + gap);
    if (row === -1) row = rowEnds.length;
    rowEnds[row] = x + width;
    return row;
  });
}

/** Beside the line, or on its left when the label wouldn't fit before the plot's right edge. */
export function labelX(x: number, width: number, right: number, gap: number): number {
  return x + gap + width > right ? x - gap - width : x + gap;
}

interface PlacedMarker {
  marker: ChartMarker;
  /** Canvas x of the line. */
  x: number;
  /** Canvas x where its label starts, its width and its row. */
  textX: number;
  width: number;
  row: number;
}

const markerFont = (colors: ChartColors, ratio: number) =>
  `600 ${String(13 * ratio)}px ${colors.font}`;
const labelBaseline = (u: uPlot, row: number, ratio: number) =>
  u.bbox.top + (16 + row * LINE_HEIGHT) * ratio;

/**
 * The markers in view with their labels: each beside its line, or left of it near the edge; rows
 * from where the labels really are, so one flipped left never runs into the label before it.
 * Measured in the markers' font, which `ctx` must be set to.
 */
function placeMarkers(u: uPlot, markers: readonly ChartMarker[]): PlacedMarker[] {
  const { ctx, bbox } = u;
  const ratio = devicePixelRatio;
  const right = bbox.left + bbox.width;
  const shown = markers
    .map((marker) => ({ marker, x: u.valToPos(marker.t, 'x', true) }))
    .filter(({ x }) => x >= bbox.left && x <= right)
    .map(({ marker, x }) => {
      const width = ctx.measureText(marker.label).width;
      return { marker, x, width, textX: labelX(x, width, right, LABEL_GAP * ratio) };
    })
    .sort((a, b) => a.textX - b.textX);
  const rows = labelRows(
    shown.map(({ textX, width }) => ({ x: textX, width })),
    LABEL_GAP * ratio,
  );
  return shown.map((placed, i) => ({ ...placed, row: rows[i] ?? 0 }));
}

/** Where the markers' labels sit on the canvas, so other names keep clear of them. */
export function markerLabelBoxes(
  u: uPlot,
  markers: readonly ChartMarker[],
  colors: ChartColors,
): Box[] {
  const ratio = devicePixelRatio;
  u.ctx.save();
  u.ctx.font = markerFont(colors, ratio);
  const boxes = placeMarkers(u, markers).map(({ textX, width, row }) => {
    const baseline = labelBaseline(u, row, ratio);
    return {
      left: textX,
      right: textX + width,
      top: baseline - 14 * ratio,
      bottom: baseline + 4 * ratio,
    };
  });
  u.ctx.restore();
  return boxes;
}

/** Event markers: 1.5px dashed vertical lines, labelled at the top unless `labels` is off (the strip). */
export function drawMarkers(
  u: uPlot,
  markers: readonly ChartMarker[],
  colors: ChartColors,
  { labels }: { labels: boolean },
): void {
  const { ctx, bbox } = u;
  const ratio = devicePixelRatio;
  ctx.save();
  ctx.font = markerFont(colors, ratio);
  for (const { marker, x, textX, row } of placeMarkers(u, markers)) {
    ctx.strokeStyle = colors.tone[marker.tone];
    ctx.fillStyle = colors.tone[marker.tone];
    ctx.lineWidth = 1.5 * ratio;
    ctx.setLineDash([4 * ratio, 4 * ratio]);
    ctx.beginPath();
    ctx.moveTo(x, bbox.top);
    ctx.lineTo(x, bbox.top + bbox.height);
    ctx.stroke();
    if (labels) ctx.fillText(marker.label, textX, labelBaseline(u, row, ratio));
  }
  ctx.restore();
}

/** The live temperature's current point: a 6px dot ringed in the surface colour. */
export function drawLatestDot(
  u: uPlot,
  seriesIndex: number,
  layer: LineLayer,
  colors: ChartColors,
): void {
  const values = u.data[seriesIndex];
  if (!values) return;
  let i = values.length - 1;
  while (i >= 0 && (values[i] === null || values[i] === undefined)) i--;
  const value = values[i];
  const t = u.data[0][i];
  if (i < 0 || value === null || value === undefined || t === undefined) return;
  const ratio = devicePixelRatio;
  const x = u.valToPos(t, 'x', true);
  const y = u.valToPos(value, layer.axis, true);
  // Past a time window's edge (History focused on a roast still cooling): no dot in the gutter.
  if (x < u.bbox.left || x > u.bbox.left + u.bbox.width) return;
  const { ctx } = u;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 6 * ratio, 0, Math.PI * 2);
  ctx.fillStyle = colors.tone[layer.tone];
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = 3 * ratio;
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}
