import { useEffect, useMemo, useRef, useState } from 'react';
import type uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { formatClock } from '../lib/format';
import { cn } from '../lib/utils';
import { alignLayers } from './roast-chart/align-layers';
import { readChartColors } from './roast-chart/chart-colors';
import type { ChartLayer, ChartMarker } from './roast-chart/chart-layer';
import { describeLayers, Legend } from './roast-chart/chart-legend';
import type { ChartDrag, TimeRange } from './roast-chart/drag-handles';
import { usePlotEngine } from './roast-chart/plot-engine';
import { buildChartOptions, buildStripOptions } from './roast-chart/uplot-options';
import { useUplot } from './roast-chart/use-uplot';

export interface RoastChartProps {
  title: string;
  /** Back to front. The first `heat` temperature layer gets the current-point dot; `output` layers go to the strip. */
  layers: readonly ChartLayer[];
  markers?: readonly ChartMarker[];
  height?: number;
  className?: string;
  /** Points you can move with the pointer. */
  drag?: ChartDrag | undefined;
}

const DEFAULT_HEIGHT = 320;
/** The outputs strip (design system: RoastChart, Outputs strip). */
const STRIP_HEIGHT = 96;
const DRAG_ROOM = 0.15;
const MIN_DRAG_ROOM_S = 30;

const structureOf = (layers: readonly ChartLayer[]) =>
  layers.map((l) => `${l.id}:${l.axis}:${l.tone}:${String(l.step ?? false)}`).join('|');

/**
 * The live roast chart (design system: RoastChart): legend above, temperature and RoR drawn with
 * uPlot (or the engine from `PlotEngineProvider`), and heater and fan in a strip underneath on the same time axis.
 */
export function RoastChart({
  title,
  layers,
  markers = [],
  height = DEFAULT_HEIGHT,
  className,
  drag,
}: RoastChartProps) {
  const engine = usePlotEngine();
  const plotRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // The time under the pointer: the legends show the values there (docs/spec/ui.md, Hover).
  const [hoverT, setHoverT] = useState<number>();
  const dragRef = useRef(drag);
  const heldTimeRange = useRef<TimeRange | undefined>(undefined);
  // Counts finished drags: fresh data lets the time axis fit the moved points again.
  const [dragsEnded, setDragsEnded] = useState(0);
  useEffect(() => {
    dragRef.current = drag;
  });
  // Spare time after the last point: its handle stays clear of the edge, and it can move later.
  const adjustTimeRange = ([from, to]: TimeRange): TimeRange =>
    heldTimeRange.current ??
    (dragRef.current
      ? [from, to + Math.max(MIN_DRAG_ROOM_S, (to - from) * DRAG_ROOM)]
      : [from, to]);

  const { main, strip, mainData, stripData } = useMemo(() => {
    const main = layers.filter((l) => l.axis !== 'output');
    const strip = layers.filter((l) => l.axis === 'output');
    // One set of times for both plots, so they share a time range and line up.
    const { xs, series } = alignLayers([...main, ...strip]);
    return {
      main,
      strip,
      mainData: [xs, ...series.slice(0, main.length)] as uPlot.AlignedData,
      stripData: [xs, ...series.slice(main.length)] as uPlot.AlignedData,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dragsEnded only asks for fresh arrays
  }, [layers, dragsEnded]);
  const rightAxis = main.some((l) => l.axis === 'ror');

  useEffect(() => {
    const element = plotRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  useUplot({
    engine,
    element: plotRef,
    structure: `${structureOf(main)}#${String(rightAxis)}`,
    width,
    height,
    data: mainData,
    markers,
    build: (size, readMarkers) =>
      buildChartOptions({
        ...size,
        layers: main,
        markers: readMarkers,
        latestDotLayer: main.findIndex((l) => l.tone === 'heat' && l.axis === 'temperature'),
        // Element is mounted whenever a build runs.
        colors: readChartColors(plotRef.current ?? document.documentElement),
        rightAxis,
        onHover: setHoverT,
        adjustTimeRange,
        dragging: {
          drag: () => dragRef.current,
          onStart: (range) => {
            heldTimeRange.current = range;
          },
          onEnd: () => {
            heldTimeRange.current = undefined;
            setDragsEnded((count) => count + 1);
          },
        },
      }),
  });
  useUplot({
    engine,
    element: stripRef,
    structure: `${structureOf(strip)}#${String(rightAxis)}`,
    width,
    height: STRIP_HEIGHT,
    data: stripData,
    markers,
    build: (size, readMarkers) =>
      buildStripOptions({
        ...size,
        layers: strip,
        markers: readMarkers,
        colors: readChartColors(stripRef.current ?? document.documentElement),
        rightAxis,
        stepped: engine.stepped(),
        onHover: setHoverT,
        adjustTimeRange,
      }),
  });

  return (
    <section
      aria-label={title}
      className={cn('flex flex-col gap-2.5 rounded-xl bg-surface px-5 py-4.5', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-heading text-ink">{title}</h2>
        <div className="flex items-center gap-4">
          {hoverT === undefined ? null : (
            <span className="text-label font-semibold text-ink tabular-nums">
              {formatClock(hoverT)}
            </span>
          )}
          <Legend label="Legend" layers={main} at={hoverT} />
        </div>
      </div>
      <div ref={plotRef} role="img" aria-label={describeLayers(main)} className="w-full" />
      {strip.length > 0 ? (
        <>
          <Legend label="Outputs legend" layers={strip} at={hoverT} className="mt-1 self-end" />
          <div ref={stripRef} role="img" aria-label={describeLayers(strip)} className="w-full" />
        </>
      ) : null}
    </section>
  );
}
