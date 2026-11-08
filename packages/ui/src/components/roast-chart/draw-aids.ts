import type uPlot from 'uplot';
import type { ChartColors } from './chart-colors';
import { placeBandNames, type Box, type CanvasLine } from './band-labels';
import type {
  ChartAid,
  NowLineLayer,
  PhaseBand,
  PhaseBandsLayer,
  ProjectionLayer,
} from './chart-layer';
import { plotPixelRatio } from './pixel-ratio';

/** The projection and the now line are drawn faint, under the lines they belong to. */
const FAINT_ALPHA = 0.55;
const PROJECTION_DASH_PX = [4, 4];
const PROJECTION_WIDTH_PX = 2;
/** A band name's chip: the `label` line height, with this much room around the text. */
const BAND_LABEL_HEIGHT_PX = 18;
const BAND_LABEL_PAD_PX = 4;
/** How far a band's name keeps from the Charge line and the plot's right edge. */
const BAND_LABEL_INSET_PX = 8;

export const nowLines = (aids: readonly ChartAid[]): NowLineLayer[] =>
  aids.filter((aid): aid is NowLineLayer => aid.kind === 'now-line');
const projections = (aids: readonly ChartAid[]): ProjectionLayer[] =>
  aids.filter((aid): aid is ProjectionLayer => aid.kind === 'projection');
const bandLayers = (aids: readonly ChartAid[]): PhaseBandsLayer[] =>
  aids.filter((aid): aid is PhaseBandsLayer => aid.kind === 'phase-bands');

interface BandBox {
  band: PhaseBand;
  /** Its fill: `band-low`, `band-mid`, `band-high`, coolest first. */
  fill: string;
  /** Canvas y of the band's top and bottom edges. */
  top: number;
  bottom: number;
}

/** Each band's place on the canvas, clipped to the plot; bands off the axis are left out. */
function bandBoxes(u: uPlot, aids: readonly ChartAid[], colors: ChartColors): BandBox[] {
  const { bbox } = u;
  const { min, max } = u.scales.temperature ?? {};
  if (min === undefined || max === undefined) return [];
  const y = (c: number) => u.valToPos(Math.min(max, Math.max(min, c)), 'temperature', true);
  return bandLayers(aids).flatMap((layer) =>
    layer.bands.flatMap((band, i) => {
      const bottom = Math.min(bbox.top + bbox.height, y(band.fromC ?? min));
      const top = Math.max(bbox.top, y(band.toC ?? max));
      const fill = colors.bands[Math.min(i, colors.bands.length - 1)] ?? colors.surface;
      return bottom > top ? [{ band, fill, top, bottom }] : [];
    }),
  );
}

/** Phase bands: full-width fills behind everything, grid included. */
export function drawPhaseBands(u: uPlot, aids: readonly ChartAid[], colors: ChartColors): void {
  const { ctx, bbox } = u;
  ctx.save();
  for (const box of bandBoxes(u, aids, colors)) {
    ctx.fillStyle = box.fill;
    ctx.fillRect(bbox.left, box.top, bbox.width, box.bottom - box.top);
  }
  ctx.restore();
}

/** Every line drawn on the plot as canvas points: the curves, the projection and the now line. */
function canvasLines(u: uPlot, aids: readonly ChartAid[]): CanvasLine[] {
  const xs = Array.from(u.data[0], (t) => u.valToPos(t, 'x', true));
  const curves = u.series.slice(1).flatMap((series, k) => {
    const values = u.data[k + 1];
    const scale = series.scale;
    if (!values || scale === undefined) return [];
    const line: CanvasLine = xs.flatMap((x, j) => {
      const v = values[j];
      // undefined: another line's time, joined across; null: a break.
      if (v === undefined) return [];
      return [v === null ? null : { x, y: u.valToPos(v, scale, true) }];
    });
    return [line];
  });
  const ahead = projections(aids).map((layer) =>
    layer.points.map((p) =>
      p.v === null ? null : { x: u.valToPos(p.t, 'x', true), y: u.valToPos(p.v, layer.axis, true) },
    ),
  );
  const now = nowLines(aids).map((line) => {
    const x = u.valToPos(line.t, 'x', true);
    return [
      { x, y: u.bbox.top },
      { x, y: u.bbox.top + u.bbox.height },
    ];
  });
  return [...curves, ...ahead, ...now];
}

/**
 * Each band's name, once, inside its own band (`placeBandNames`): just right of the Charge line
 * when it is in view, else at the plot's right edge, else just right of another marker's line; on
 * a `surface` chip, so the grid never cuts through it and the name keeps its 4.5:1 on every band.
 * A band with no free spot has no name.
 */
export function drawBandLabels(
  u: uPlot,
  aids: readonly ChartAid[],
  markers: { labels: readonly Box[]; lines: readonly Box[] },
  colors: ChartColors,
): void {
  const boxes = bandBoxes(u, aids, colors);
  if (boxes.length === 0) return;
  const { ctx, bbox } = u;
  const ratio = plotPixelRatio(u);
  const inset = BAND_LABEL_INSET_PX * ratio;
  const pad = BAND_LABEL_PAD_PX * ratio;
  const charge = u.valToPos(0, 'x', true);
  const left = (charge > bbox.left && charge < bbox.left + bbox.width ? charge : bbox.left) + inset;
  const right = bbox.left + bbox.width - inset;
  ctx.save();
  ctx.font = `500 ${String(13 * ratio)}px ${colors.font}`;
  ctx.textBaseline = 'middle';
  const spots = placeBandNames(
    boxes.map((box) => ({
      top: box.top,
      bottom: box.bottom,
      width: ctx.measureText(box.band.label).width + 2 * pad,
    })),
    {
      lefts: (width) =>
        [left, right - width, ...markers.lines.map((line) => line.right + inset)].filter(
          (x) => x >= bbox.left && x + width <= right,
        ),
      height: BAND_LABEL_HEIGHT_PX * ratio,
      pad,
      lines: canvasLines(u, aids),
      taken: [...markers.labels, ...markers.lines],
    },
  );
  boxes.forEach((box, i) => {
    const spot = spots[i];
    if (!spot) return;
    ctx.fillStyle = colors.surface;
    ctx.fillRect(spot.left, spot.top, spot.right - spot.left, spot.bottom - spot.top);
    ctx.fillStyle = colors.axis;
    ctx.fillText(box.band.label, spot.left + pad, (spot.top + spot.bottom) / 2);
  });
  ctx.restore();
}

/** The hottest point an aid draws on the temperature axis (the projection), in the unit shown. */
export function aidsTop(aids: readonly ChartAid[]): number | undefined {
  const values = projections(aids)
    .filter((layer) => layer.axis === 'temperature')
    .flatMap((layer) => layer.points.flatMap((p) => (p.v === null ? [] : [p.v])));
  return values.length === 0 ? undefined : Math.max(...values);
}

/** Projections: a faint dashed straight line in the colour of the line it continues. */
export function drawProjections(u: uPlot, aids: readonly ChartAid[], colors: ChartColors): void {
  const { ctx } = u;
  const ratio = plotPixelRatio(u);
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
  const ratio = plotPixelRatio(u);
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
