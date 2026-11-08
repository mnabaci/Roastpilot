import type uPlot from 'uplot';
import type { ChartColors } from './chart-colors';
import type { ChartAid, NowLineLayer, PhaseBandsLayer, ProjectionLayer } from './chart-layer';

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
/** The `label` type style's line height: a band too thin for its name shows none. */
const BAND_LABEL_HEIGHT_PX = 18;

export const nowLines = (aids: readonly ChartAid[]): NowLineLayer[] =>
  aids.filter((aid): aid is NowLineLayer => aid.kind === 'now-line');
const projections = (aids: readonly ChartAid[]): ProjectionLayer[] =>
  aids.filter((aid): aid is ProjectionLayer => aid.kind === 'projection');
const bandLayers = (aids: readonly ChartAid[]): PhaseBandsLayer[] =>
  aids.filter((aid): aid is PhaseBandsLayer => aid.kind === 'phase-bands');

/** Phase bands behind everything, grid included, each named once at its bottom-left corner. */
export function drawPhaseBands(u: uPlot, aids: readonly ChartAid[], colors: ChartColors): void {
  const { ctx, bbox } = u;
  const ratio = devicePixelRatio;
  const { min, max } = u.scales.temperature ?? {};
  if (min === undefined || max === undefined) return;
  const top = bbox.top;
  const bottom = bbox.top + bbox.height;
  ctx.save();
  ctx.font = `500 ${String(13 * ratio)}px ${colors.font}`;
  ctx.textBaseline = 'bottom';
  for (const layer of bandLayers(aids)) {
    layer.bands.forEach((band, i) => {
      const y0 = Math.min(
        bottom,
        u.valToPos(Math.max(band.fromC ?? min, min), 'temperature', true),
      );
      const y1 = Math.max(top, u.valToPos(Math.min(band.toC ?? max, max), 'temperature', true));
      if (y0 <= y1) return;
      ctx.globalAlpha = BAND_ALPHAS[Math.min(i, BAND_ALPHAS.length - 1)] ?? 0;
      ctx.fillStyle = colors.tone.ink;
      ctx.fillRect(bbox.left, y1, bbox.width, y0 - y1);
      if (y0 - y1 < (BAND_LABEL_HEIGHT_PX + BAND_LABEL_INSET_PX) * ratio) return;
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.axis;
      ctx.fillText(
        band.label,
        bbox.left + BAND_LABEL_INSET_PX * ratio,
        y0 - (BAND_LABEL_INSET_PX / 2) * ratio,
      );
    });
  }
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
