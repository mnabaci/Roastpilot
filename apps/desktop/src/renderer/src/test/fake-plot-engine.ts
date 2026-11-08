import type { PlotEngine } from '@roastpilot/ui';

const nothing = (): undefined => undefined;

/**
 * The real chart draws on a canvas, which jsdom doesn't have; its drawing is tested in packages/ui.
 * Screens render the real RoastChart (title, legend, description) with plots that draw nothing.
 */
export const fakePlotEngine: PlotEngine = {
  create: () => ({ setData: nothing, setSize: nothing, redraw: nothing, destroy: nothing }),
  stepped: nothing,
};
