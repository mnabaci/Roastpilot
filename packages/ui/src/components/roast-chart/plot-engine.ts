import { createContext, useContext } from 'react';
import uPlot from 'uplot';

/** One drawn plot: what RoastChart does to it after creating it. */
export interface Plot {
  setData: (data: uPlot.AlignedData) => void;
  setSize: (size: { width: number; height: number }) => void;
  redraw: (rebuildPaths?: boolean) => void;
  destroy: () => void;
}

/** What draws RoastChart's plots: uPlot in the app, a fake in tests (jsdom has no canvas). */
export interface PlotEngine {
  create: (options: uPlot.Options, data: uPlot.AlignedData, element: HTMLElement) => Plot;
  /** The step-line path builder for the outputs strip. */
  stepped: () => uPlot.Series.PathBuilder | undefined;
}

export const uplotEngine: PlotEngine = {
  create: (options, data, element) => new uPlot(options, data, element),
  stepped: () => uPlot.paths.stepped?.({ align: 1 }),
};

const PlotEngineContext = createContext<PlotEngine>(uplotEngine);

/** Swaps the engine for everything inside it; without it, RoastChart draws with uPlot. */
export const PlotEngineProvider = PlotEngineContext.Provider;

export const usePlotEngine = (): PlotEngine => useContext(PlotEngineContext);
