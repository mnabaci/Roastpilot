import { useEffect, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { cn } from '../lib/utils';
import { alignLayers } from './roast-chart/align-layers';
import { readChartColors } from './roast-chart/chart-colors';
import type { ChartLayer, ChartMarker } from './roast-chart/chart-layer';
import { buildChartOptions } from './roast-chart/uplot-options';

export interface RoastChartProps {
  title: string;
  /** Back to front. The first `heat` temperature layer gets the current-point dot. */
  layers: readonly ChartLayer[];
  markers?: readonly ChartMarker[];
  height?: number;
  className?: string;
}

const DEFAULT_HEIGHT = 320;

/** The live roast chart (design system: RoastChart): legend above, layers drawn with uPlot. */
export function RoastChart({
  title,
  layers,
  markers = [],
  height = DEFAULT_HEIGHT,
  className,
}: RoastChartProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const markersRef = useRef(markers);
  const [width, setWidth] = useState(0);

  // Rebuild only when the set of layers changes; new points are a setData, not a new chart.
  const structure = layers.map((l) => `${l.id}:${l.axis}:${l.tone}`).join('|');

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

  useEffect(() => {
    const element = plotRef.current;
    if (!element) return;
    const aligned = alignLayers(layers);
    const latestDotLayer = layers.findIndex((l) => l.tone === 'heat' && l.axis === 'temperature');
    const chart = new uPlot(
      buildChartOptions({
        width: width || element.clientWidth || 600,
        height,
        layers,
        markers: () => markersRef.current,
        latestDotLayer,
        colors: readChartColors(element),
      }),
      [aligned.xs, ...aligned.series],
      element,
    );
    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
    // Layers' points are pushed by the next effect; this one only runs when the structure changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure, height]);

  useEffect(() => {
    const aligned = alignLayers(layers);
    chartRef.current?.setData([aligned.xs, ...aligned.series]);
  }, [layers]);

  useEffect(() => {
    markersRef.current = markers;
    chartRef.current?.redraw(false);
  }, [markers]);

  useEffect(() => {
    if (width > 0) chartRef.current?.setSize({ width, height });
  }, [width, height]);

  return (
    <section
      aria-label={title}
      className={cn('flex flex-col gap-2.5 rounded-xl bg-surface px-5 py-4.5', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-heading text-ink">{title}</h2>
        <ul aria-label="Legend" className="flex flex-wrap gap-4 text-label text-ink-muted">
          {layers.map((layer) => (
            <li key={layer.id} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  'w-4.5',
                  layer.dash ? 'border-t-2 border-dashed' : layer.width > 3 ? 'h-0.75' : 'h-0.5',
                  {
                    heat: layer.dash ? 'border-heat' : 'bg-heat',
                    air: layer.dash ? 'border-air' : 'bg-air',
                    target: layer.dash ? 'border-target' : 'bg-target',
                    ghost: layer.dash ? 'border-ghost' : 'bg-ghost',
                  }[layer.tone],
                )}
              />
              {layer.label}
            </li>
          ))}
        </ul>
      </div>
      <div ref={plotRef} role="img" aria-label={describe(layers)} className="w-full" />
    </section>
  );
}

/** A one-line text alternative: the latest value of each layer. */
function describe(layers: readonly ChartLayer[]): string {
  const parts = layers.flatMap((layer) => {
    const latest = layer.points.at(-1);
    if (!latest) return [];
    const unit = layer.axis === 'ror' ? '°C/min' : '°C';
    return [`${layer.label} ${latest.v.toFixed(1)} ${unit}`];
  });
  return parts.length > 0 ? parts.join(', ') : 'No readings yet';
}
