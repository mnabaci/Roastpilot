import type uPlot from 'uplot';
import type { ChartColors } from './chart-colors';
import { labelSpot, type Box, type CanvasLine } from './band-labels';
import type {
  ChartAid,
  NowLineLayer,
  PhaseBand,
  PhaseBandsLayer,
  ProjectionLayer,
} from './chart-layer';

/**
 * Each band one shade darker than the one below, from the `ink` token (design system: RoastChart,
 * Aids): the beans darken as they climb through drying, Maillard and development.
 */
export const BAND_ALPHAS = [0.03, 0.06, 0.09] as const;
/** The projection and the now line are drawn faint, under the lines they belong to. */
const FAINT_ALPHA = 0.55;
const PROJECTION_DASH_PX = [4, 4];
const PROJECTION_WIDTH_PX = 2;
const BAND_LABEL_INSET_PX = 8;
/** The `label` type style's line height: the room a band's name takes. */
const BAND_LABEL_HEIGHT_PX = 18;

export const nowLines = (aids: readonly ChartAid[]): NowLineLayer[] =>
  aids.filter((aid): aid is NowLineLayer => aid.kind === 'now-line');
const projections = (aids: readonly ChartAid[]): ProjectionLayer[] =>
  aids.filter((aid): aid is ProjectionLayer => aid.kind === 'projection');
const bandLayers = (aids: readonly ChartAid[]): PhaseBandsLayer[] =>
  aids.filter((aid): aid is PhaseBandsLayer => aid.kind === 'phase-bands');

interface BandBox {
  band: PhaseBand;
  alpha: number;
  /** Canvas y of the band's top and bottom edges. */
  top: number;
  bottom: number;
}

/** Each band's place on the canvas, clipped to the plot; bands off the axis are left out. */
function bandBoxes(u: uPlot, aids: readonly ChartAid[]): BandBox[] {
  const { bbox } = u;
  const { min, max } = u.scales.temperature ?? {};
  if (min === undefined || max === undefined) return [];
  const y = (c: number) => u.valToPos(Math.min(max, Math.max(min, c)), 'temperature', true);
  return bandLayers(aids).flatMap((layer) =>
    layer.bands.flatMap((band, i) => {
      const bottom = Math.min(bbox.top + bbox.height, y(band.fromC ?? min));
      const top = Math.max(bbox.top, y(band.toC ?? max));
      const alpha = BAND_ALPHAS[Math.min(i, BAND_ALPHAS.length - 1)] ?? 0;
      return bottom > top ? [{ band, alpha, top, bottom }] : [];
    }),
  );
}

/** Phase bands: full-width fills behind everything, grid included. */
export function drawPhaseBands(u: uPlot, aids: readonly ChartAid[], colors: ChartColors): void {
  const { ctx, bbox } = u;
  ctx.save();
  ctx.fillStyle = colors.tone.ink;
  for (const box of bandBoxes(u, aids)) {
    ctx.globalAlpha = box.alpha;
    ctx.fillRect(bbox.left, box.top, bbox.width, box.bottom - box.top);
  }
  ctx.restore();
}

/** Every line drawn on the plot, as canvas points, up to `rightPx`. */
function canvasLines(u: uPlot, rightPx: number): CanvasLine[] {
  const xs = Array.from(u.data[0], (t) => u.valToPos(t, 'x', true));
  const last = xs.findIndex((x) => x > rightPx);
  const end = last === -1 ? xs.length : last + 1;
  return u.series.slice(1).flatMap((series, k) => {
    const values = u.data[k + 1];
    const scale = series.scale;
    if (!values || scale === undefined) return [];
    const line: CanvasLine = xs.slice(0, end).flatMap((x, j) => {
      const v = values[j];
      // undefined: another line's time, joined across; null: a break.
      if (v === undefined) return [];
      return [v === null ? null : { x, y: u.valToPos(v, scale, true) }];
    });
    return [line];
  });
}

/**
 * Each band's name, once, at its left edge (just right of the Charge line when it is in view): at
 * the bottom of the band, or its top when a curve runs there (under the marker labels when they
 * sit there); when all of those are taken, at its right edge. On a chip of the band's own shade so
 * the grid never cuts through it. A band with no free spot has no name.
 */
export function drawBandLabels(
  u: uPlot,
  aids: readonly ChartAid[],
  taken: readonly Box[],
  colors: ChartColors,
): void {
  const boxes = bandBoxes(u, aids);
  if (boxes.length === 0) return;
  const { ctx, bbox } = u;
  const ratio = devicePixelRatio;
  const inset = BAND_LABEL_INSET_PX * ratio;
  const height = BAND_LABEL_HEIGHT_PX * ratio;
  const charge = u.valToPos(0, 'x', true);
  const left = (charge > bbox.left && charge < bbox.left + bbox.width ? charge : bbox.left) + inset;
  ctx.save();
  ctx.font = `500 ${String(13 * ratio)}px ${colors.font}`;
  ctx.textBaseline = 'middle';
  const widths = boxes.map((box) => ctx.measureText(box.band.label).width);
  const lines = canvasLines(u, Infinity);
  const plotRight = bbox.left + bbox.width;
  boxes.forEach((box, i) => {
    const width = widths[i] ?? 0;
    const at = (x: number): Box[] => {
      const right = x + width;
      // Under the marker labels that reach across this name's span, for the top spot's second try.
      const below = Math.max(
        box.top,
        ...taken.filter((t) => t.left <= right && t.right >= x).map((t) => t.bottom),
      );
      return [
        { left: x, right, bottom: box.bottom - inset / 2, top: box.bottom - inset / 2 - height },
        { left: x, right, top: box.top + inset / 2, bottom: box.top + inset / 2 + height },
        { left: x, right, top: below + inset, bottom: below + inset + height },
      ];
    };
    // The left edge first; the right edge, still empty mid-roast, when the left is crowded.
    const spots = [...at(left), ...at(plotRight - inset - width)].filter(
      (spot) => spot.top >= box.top && spot.bottom <= box.bottom,
    );
    const spot = labelSpot(spots, lines, taken);
    if (!spot) return;
    const chip = { x: spot.left - inset / 2, w: spot.right - spot.left + inset };
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.surface;
    ctx.fillRect(chip.x, spot.top, chip.w, height);
    ctx.globalAlpha = box.alpha;
    ctx.fillStyle = colors.tone.ink;
    ctx.fillRect(chip.x, spot.top, chip.w, height);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.axis;
    ctx.fillText(box.band.label, spot.left, (spot.top + spot.bottom) / 2);
  });
  ctx.restore();
}

/** Projections: a faint dashed straight line in the colour of the line it continues. */
export function drawProjections(u: uPlot, aids: readonly ChartAid[], colors: ChartColors): void {
  const { ctx } = u;
  const ratio = devicePixelRatio;
  ctx.save();
  ctx.globalAlpha = FAINT_ALPHA;
  ctx.lineWidth = PROJECTION_WIDTH_PX * ratio;
  ctx.setLineDash(PROJECTION_DASH_PX.map((px) => px * ratio));
  ctx.lineCap = 'round';
  for (const layer of projections(aids)) {
    if (layer.points.length < 2) continue;
    ctx.strokeStyle = colors.tone[layer.tone];
    ctx.beginPath();
    layer.points.forEach((point, i) => {
      if (point.v === null) return;
      const x = u.valToPos(point.t, 'x', true);
      const y = u.valToPos(point.v, layer.axis, true);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.restore();
}

/** The now line: 1px solid `ink-muted`, faint, from the plot's top to its bottom. */
export function drawNowLines(u: uPlot, aids: readonly ChartAid[], colors: ChartColors): void {
  const { ctx, bbox } = u;
  const ratio = devicePixelRatio;
  ctx.save();
  ctx.globalAlpha = FAINT_ALPHA;
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = ratio;
  for (const line of nowLines(aids)) {
    const x = u.valToPos(line.t, 'x', true);
    if (x < bbox.left || x > bbox.left + bbox.width) continue;
    ctx.beginPath();
    ctx.moveTo(x, bbox.top);
    ctx.lineTo(x, bbox.top + bbox.height);
    ctx.stroke();
  }
  ctx.restore();
}
