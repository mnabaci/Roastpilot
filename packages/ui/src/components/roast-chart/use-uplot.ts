import { useEffect, useRef, type RefObject } from 'react';
import type uPlot from 'uplot';
import type { ChartAid, ChartMarker } from './chart-layer';
import type { Plot, PlotEngine } from './plot-engine';

/** What is drawn over the lines, read at draw time: a change is a redraw, not a rebuild. */
export interface Overlay {
  markers: readonly ChartMarker[];
  aids: readonly ChartAid[];
}

export interface UplotInput {
  /** What draws the plot (`usePlotEngine()`). */
  engine: PlotEngine;
  element: RefObject<HTMLDivElement | null>;
  /** Rebuild only when this changes (the set of layers, the height); new points are a setData. */
  structure: string;
  width: number;
  height: number;
  data: uPlot.AlignedData;
  /** Changes when the scales must be worked out again with the same data (a new time window). */
  scaleKey: string;
  overlay: Overlay;
  /** Builds the options; `overlay()` is read at draw time. */
  build: (size: { width: number; height: number }, overlay: () => Overlay) => uPlot.Options;
}

/** Runs one plot in `element`: built on a structure change, fed by setData, redrawn for its overlay, resized with width. */
export function useUplot({
  engine,
  element,
  structure,
  width,
  height,
  data,
  scaleKey,
  overlay,
  build,
}: UplotInput): void {
  const chartRef = useRef<Plot | null>(null);
  const overlayRef = useRef(overlay);
  const dataRef = useRef(data);
  const buildRef = useRef(build);

  useEffect(() => {
    dataRef.current = data;
    buildRef.current = build;
  });

  useEffect(() => {
    const el = element.current;
    if (!el) return;
    const chart = engine.create(
      buildRef.current({ width: width || el.clientWidth || 600, height }, () => overlayRef.current),
      dataRef.current,
      el,
    );
    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
    // Width changes are a setSize below; points are a setData. Only structure and height rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure, height, element, engine]);

  // setData works the scales out again, so a new window or floor takes effect with no new points.
  useEffect(() => {
    chartRef.current?.setData(data);
  }, [data, scaleKey]);

  useEffect(() => {
    overlayRef.current = overlay;
    chartRef.current?.redraw(false);
  }, [overlay]);

  useEffect(() => {
    if (width > 0) chartRef.current?.setSize({ width, height });
  }, [width, height]);
}
