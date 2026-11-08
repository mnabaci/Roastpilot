import type uPlot from 'uplot';
import type { ChartColors } from './chart-colors';
import { overlaps, type Box } from './band-labels';
import type { ChartMarker } from './chart-layer';
import { plotPixelRatio } from './pixel-ratio';

const LABEL_GAP = 8;
const LINE_HEIGHT = 18;

/**
 * Label rows, one per marker in time order: a label goes to the first row where it doesn't
 * run into the label before it, so close events (first crack, then drop) never overlap. A row
 * `blocked` for a label (the current-point dot is there) is skipped; `blocked` must clear for the
 * rows below whatever it guards, as a box on the plot does.
 */
export function labelRows(
  labels: readonly { x: number; width: number }[],
  gap: number,
  blocked: (row: number, index: number) => boolean = () => false,
): number[] {
  const rowEnds: number[] = [];
  return labels.map(({ x, width }, index) => {
    let row = 0;
    while (x < (rowEnds[row] ?? Number.NEGATIVE_INFINITY) + gap || blocked(row, index)) row++;
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

/** The box a label of this width takes in this row. */
function labelBox(u: uPlot, textX: number, width: number, row: number, ratio: number): Box {
  const baseline = labelBaseline(u, row, ratio);
  return {
    left: textX,
    right: textX + width,
    top: baseline - 14 * ratio,
    bottom: baseline + 4 * ratio,
  };
}

/**
 * The markers in view with their labels: each beside its line, or left of it near the edge; rows
 * from where the labels really are, so one flipped left never runs into the label before it, and
 * none covers a `keepClear` box (the current-point dot). Measured in the markers' font, which
 * `ctx` must be set to.
 */
function placeMarkers(
  u: uPlot,
  markers: readonly ChartMarker[],
  keepClear: readonly Box[],
): PlacedMarker[] {
  const { ctx, bbox } = u;
  const ratio = plotPixelRatio(u);
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
    (row, i) => {
      const label = shown[i];
      if (!label) return false;
      const box = labelBox(u, label.textX, label.width, row, ratio);
      return keepClear.some((clear) => overlaps(box, clear));
    },
  );
  return shown.map((placed, i) => ({ ...placed, row: rows[i] ?? 0 }));
}

/** Where the markers' labels sit on the canvas, so other names keep clear of them. */
export function markerLabelBoxes(
  u: uPlot,
  markers: readonly ChartMarker[],
  colors: ChartColors,
  keepClear: readonly Box[] = [],
): Box[] {
  const ratio = plotPixelRatio(u);
  u.ctx.save();
  u.ctx.font = markerFont(colors, ratio);
  const boxes = placeMarkers(u, markers, keepClear).map(({ textX, width, row }) =>
    labelBox(u, textX, width, row, ratio),
  );
  u.ctx.restore();
  return boxes;
}

/** Where the markers' lines run, as thin boxes, so a band's name never sits across one. */
export function markerLineBoxes(u: uPlot, markers: readonly ChartMarker[]): Box[] {
  const { bbox } = u;
  const half = plotPixelRatio(u);
  return markers.flatMap((marker) => {
    const x = u.valToPos(marker.t, 'x', true);
    return x >= bbox.left && x <= bbox.left + bbox.width
      ? [{ left: x - half, right: x + half, top: bbox.top, bottom: bbox.top + bbox.height }]
      : [];
  });
}

/**
 * Event markers: 1.5px dashed vertical lines, labelled at the top unless `labels` is off (the
 * strip). Labels keep off the `keepClear` boxes (the current-point dot).
 */
export function drawMarkers(
  u: uPlot,
  markers: readonly ChartMarker[],
  colors: ChartColors,
  { labels, keepClear = [] }: { labels: boolean; keepClear?: readonly Box[] },
): void {
  const { ctx, bbox } = u;
  const ratio = plotPixelRatio(u);
  ctx.save();
  ctx.font = markerFont(colors, ratio);
  for (const { marker, x, textX, row } of placeMarkers(u, markers, keepClear)) {
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
