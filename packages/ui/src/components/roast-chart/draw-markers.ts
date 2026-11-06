import type uPlot from 'uplot';
import type { ChartColors } from './chart-colors';
import type { ChartLayer, ChartMarker } from './chart-layer';

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
  ctx.font = `600 ${String(13 * ratio)}px ${colors.font}`;
  const shown = [...markers]
    .sort((a, b) => a.t - b.t)
    .map((marker) => ({ marker, x: u.valToPos(marker.t, 'x', true) }))
    .filter(({ x }) => x >= bbox.left && x <= bbox.left + bbox.width);
  const rows = labelRows(
    shown.map(({ marker, x }) => ({
      x: x + LABEL_GAP * ratio,
      width: ctx.measureText(marker.label).width,
    })),
    LABEL_GAP * ratio,
  );
  shown.forEach(({ marker, x }, i) => {
    ctx.strokeStyle = colors.tone[marker.tone];
    ctx.fillStyle = colors.tone[marker.tone];
    ctx.lineWidth = 1.5 * ratio;
    ctx.setLineDash([4 * ratio, 4 * ratio]);
    ctx.beginPath();
    ctx.moveTo(x, bbox.top);
    ctx.lineTo(x, bbox.top + bbox.height);
    ctx.stroke();
    if (!labels) return;
    const row = rows[i] ?? 0;
    const textX = labelX(
      x,
      ctx.measureText(marker.label).width,
      bbox.left + bbox.width,
      LABEL_GAP * ratio,
    );
    ctx.fillText(marker.label, textX, bbox.top + (16 + row * LINE_HEIGHT) * ratio);
  });
  ctx.restore();
}

/** The live temperature's current point: a 6px dot ringed in the surface colour. */
export function drawLatestDot(
  u: uPlot,
  seriesIndex: number,
  layer: ChartLayer,
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
