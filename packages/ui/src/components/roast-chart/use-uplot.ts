import { useEffect, useRef, type RefObject } from 'react';
import uPlot from 'uplot';
import type { ChartMarker } from './chart-layer';

export interface UplotInput {
  element: RefObject<HTMLDivElement | null>;
  /** Rebuild only when this changes (the set of layers, the height); new points are a setData. */
  structure: string;
  width: number;
  height: number;
  data: uPlot.AlignedData;
  markers: readonly ChartMarker[];
  /** Builds the options; `markers()` is read at draw time. */
  build: (
    size: { width: number; height: number },
    markers: () => readonly ChartMarker[],
  ) => uPlot.Options;
}

/** Runs one uPlot in `element`: built on a structure change, fed by setData, redrawn for markers, resized with width. */
export function useUplot({
  element,
  structure,
  width,
  height,
  data,
  markers,
  build,
}: UplotInput): void {
  const chartRef = useRef<uPlot | null>(null);
  const markersRef = useRef(markers);
  const dataRef = useRef(data);
  const buildRef = useRef(build);

  useEffect(() => {
    dataRef.current = data;
    buildRef.current = build;
  });

  useEffect(() => {
    const el = element.current;
    if (!el) return;
    const chart = new uPlot(
      buildRef.current({ width: width || el.clientWidth || 600, height }, () => markersRef.current),
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
  }, [structure, height, element]);

  useEffect(() => {
    chartRef.current?.setData(data);
  }, [data]);

  useEffect(() => {
    markersRef.current = markers;
    chartRef.current?.redraw(false);
  }, [markers]);

  useEffect(() => {
    if (width > 0) chartRef.current?.setSize({ width, height });
  }, [width, height]);
}
