import type { TemperatureUnit } from '@roastpilot/shared';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import 'uplot/dist/uPlot.min.css';
import { formatClock } from '../lib/format';
import { cn } from '../lib/utils';
import { readChartColors } from './roast-chart/chart-colors';
import type { ChartLayer, ChartMarker, LineLayer } from './roast-chart/chart-layer';
import { describeLayers, Legend } from './roast-chart/chart-legend';
import { dragInUnit, floorInUnit, layersInUnit } from './roast-chart/display-units';
import type { ChartDrag, TimeRange } from './roast-chart/drag-handles';
import { usePlotEngine } from './roast-chart/plot-engine';
import { buildChartOptions, buildStripOptions } from './roast-chart/uplot-options';
import { splitLayers } from './roast-chart/split-layers';
import { useThemeKey } from './roast-chart/use-theme-key';
import { useUplot } from './roast-chart/use-uplot';
import { valueAt, valueNow } from './roast-chart/value-at';

export interface RoastChartProps {
  title: string;
  /** A quiet control beside the title, such as History's Show preheat. */
  titleAction?: ReactNode;
  /**
   * Back to front. The first `heat` temperature line gets the current-point dot; `output` lines go
   * to the strip. Aids (now line, projection, phase bands) have no legend entry.
   */
  layers: readonly ChartLayer[];
  markers?: readonly ChartMarker[];
  /** The time axis's span in seconds since charge; without it, the axis fits the data. */
  timeWindow?: { fromS: number; toS: number } | undefined;
  /** Where the temperature axis starts, °C (default 0). */
  temperatureFloorC?: number;
  /**
   * What the axes, legend and hover say: everything is given in °C and shown in this unit
   * (default °C; docs/spec/ui.md, Units).
   */
  temperatureUnit?: TemperatureUnit;
  height?: number;
  className?: string;
  /** Points you can move with the pointer, in °C; a move comes back in °C too. */
  drag?: ChartDrag | undefined;
  /**
   * A live roast: when not hovering, the legends show each line's latest value, at the live
   * temperature's last reading, instead of names only (docs/spec/ui.md, Hover).
   */
  showLatest?: boolean;
}

const DEFAULT_HEIGHT = 320;
/** The outputs strip (design system: RoastChart, Outputs strip). */
const STRIP_HEIGHT = 96;
const DRAG_ROOM = 0.15;
const MIN_DRAG_ROOM_S = 30;

const NO_MARKERS: readonly ChartMarker[] = [];

const structureOf = (layers: readonly LineLayer[]) =>
  layers.map((l) => `${l.id}:${l.axis}:${l.tone}:${String(l.step ?? false)}`).join('|');

/**
 * The live roast chart (design system: RoastChart): legend above, temperature and RoR drawn with
 * uPlot (or the engine from `PlotEngineProvider`), and heater and fan in a strip underneath on the same time axis.
 */
export function RoastChart({
  title,
  titleAction,
  layers,
  markers = NO_MARKERS,
  timeWindow,
  temperatureFloorC = 0,
  temperatureUnit = 'c',
  height = DEFAULT_HEIGHT,
  className,
  drag: dragC,
  showLatest = false,
}: RoastChartProps) {
  const unit = temperatureUnit;
  const drag = useMemo(() => dragInUnit(dragC, unit), [dragC, unit]);
  const floor = floorInUnit(temperatureFloorC, unit);
  const engine = usePlotEngine();
  const plotRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // The time under the pointer: the legends show the values there (docs/spec/ui.md, Hover).
  const [hoverT, setHoverT] = useState<number>();
  const dragRef = useRef(drag);
  const windowRef = useRef(timeWindow);
  const floorRef = useRef(floor);
  const heldTimeRange = useRef<TimeRange | undefined>(undefined);
  // Counts finished drags: fresh data lets the time axis fit the moved points again.
  const [dragsEnded, setDragsEnded] = useState(0);
  // Before the plots' own effects, so a setData after a new window or floor reads them.
  useEffect(() => {
    dragRef.current = drag;
    windowRef.current = timeWindow;
    floorRef.current = floor;
  });
  // A window is shown as given; otherwise the data's span, with spare time after the last point
  // while dragging: its handle stays clear of the edge, and it can move later.
  const adjustTimeRange = ([from, to]: TimeRange): TimeRange => {
    const shown = windowRef.current;
    if (heldTimeRange.current) return heldTimeRange.current;
    if (shown) return [shown.fromS, shown.toS];
    return dragRef.current
      ? [from, to + Math.max(MIN_DRAG_ROOM_S, (to - from) * DRAG_ROOM)]
      : [from, to];
  };

  const { main, strip, mainData, stripData, mainOverlay, stripOverlay } = useMemo(
    () => splitLayers(layersInUnit(layers, unit), markers),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dragsEnded only asks for fresh arrays
    [layers, markers, unit, dragsEnded],
  );
  const latestDotLayer = main.findIndex((l) => l.tone === 'heat' && l.axis === 'temperature');
  // Now: the live temperature's last reading, so every value shown is from the same moment.
  const nowT = showLatest ? main[latestDotLayer]?.points.at(-1)?.t : undefined;
  const legendValue = useMemo(() => {
    if (hoverT !== undefined) return (layer: LineLayer) => valueAt(layer, hoverT);
    if (nowT !== undefined) return (layer: LineLayer) => valueNow(layer, nowT);
    return undefined;
  }, [hoverT, nowT]);
  const scaleKey = `${String(timeWindow?.fromS)}:${String(timeWindow?.toS)}:${String(floor)}`;
  const rightAxis = main.some((l) => l.axis === 'ror');
  // Colours are read when a plot is built: a new theme rebuilds both.
  const theme = useThemeKey();

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
    structure: `${structureOf(main)}#${String(rightAxis)}#${theme}#${unit}`,
    width,
    height,
    data: mainData,
    scaleKey,
    overlay: mainOverlay,
    build: (size, overlay) =>
      buildChartOptions({
        ...size,
        layers: main,
        markers: () => overlay().markers,
        aids: () => overlay().aids,
        temperatureFloor: () => floorRef.current,
        unit,
        latestDotLayer,
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
    structure: `${structureOf(strip)}#${String(rightAxis)}#${theme}`,
    width,
    height: STRIP_HEIGHT,
    data: stripData,
    scaleKey,
    overlay: stripOverlay,
    build: (size, overlay) =>
      buildStripOptions({
        ...size,
        layers: strip,
        markers: () => overlay().markers,
        aids: () => overlay().aids,
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
        <div className="flex items-center gap-3">
          <h2 className="text-heading text-ink">{title}</h2>
          {titleAction}
        </div>
        <div className="flex items-center gap-4">
          {hoverT === undefined ? null : (
            <span className="text-label font-semibold text-ink tabular-nums">
              {formatClock(hoverT)}
            </span>
          )}
          <Legend label="Legend" layers={main} valueOf={legendValue} unit={unit} />
        </div>
      </div>
      <div ref={plotRef} role="img" aria-label={describeLayers(main, unit)} className="w-full" />
      {strip.length > 0 ? (
        <>
          <Legend
            label="Outputs legend"
            layers={strip}
            valueOf={legendValue}
            unit={unit}
            className="mt-1 self-end"
          />
          <div
            ref={stripRef}
            role="img"
            aria-label={describeLayers(strip, unit)}
            className="w-full"
          />
        </>
      ) : null}
    </section>
  );
}
