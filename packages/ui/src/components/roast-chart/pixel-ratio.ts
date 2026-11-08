import type uPlot from 'uplot';

/**
 * Device pixels per CSS pixel on this plot's canvas: the ratio uPlot sized it for. Everything drawn
 * on top scales by this, never by the window's `devicePixelRatio`, which changes first when the
 * window moves to another display (or the zoom changes) and would draw labels and lines at the
 * wrong size until uPlot catches up. 1 before the plot has a size.
 */
export function plotPixelRatio(u: Pick<uPlot, 'ctx' | 'width'>): number {
  const ratio = u.ctx.canvas.width / u.width;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}
