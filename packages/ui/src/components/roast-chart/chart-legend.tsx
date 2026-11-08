import type { TemperatureUnit } from '@roastpilot/shared';
import { cn } from '../../lib/utils';
import type { LineLayer } from './chart-layer';
import { formatLayerValue } from './value-at';

/**
 * Each layer's line sample and name; the outputs strip has its own, under the chart. With `valueOf`
 * (hovering, or now during a roast), each name is followed by that value, a dash where it has none.
 */
export function Legend({
  label,
  layers,
  valueOf,
  unit,
  className,
}: {
  label: string;
  layers: readonly LineLayer[];
  valueOf: ((layer: LineLayer) => number | undefined) | undefined;
  /** The unit the layers' values are already in. */
  unit: TemperatureUnit;
  className?: string;
}) {
  return (
    <ul
      aria-label={label}
      className={cn('flex flex-wrap gap-4 text-label text-ink-muted tabular-nums', className)}
    >
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
                neutral: layer.dash ? 'border-ink-muted' : 'bg-ink-muted',
                target: layer.dash ? 'border-target' : 'bg-target',
                ghost: layer.dash ? 'border-ghost' : 'bg-ghost',
              }[layer.tone],
            )}
          />
          {layer.label}
          {valueOf === undefined ? null : (
            <LegendValue layer={layer} value={valueOf(layer)} unit={unit} />
          )}
        </li>
      ))}
    </ul>
  );
}

function LegendValue({
  layer,
  value: v,
  unit,
}: {
  layer: LineLayer;
  value: number | undefined;
  unit: TemperatureUnit;
}) {
  return (
    <span className="font-semibold text-ink">
      {v === undefined ? '–' : formatLayerValue(layer.axis, v, unit)}
    </span>
  );
}

/** A one-line text alternative: the latest value of each layer. */
export function describeLayers(layers: readonly LineLayer[], unit: TemperatureUnit): string {
  const parts = layers.flatMap((layer) => {
    const v = layer.points.findLast((p) => p.v !== null)?.v ?? undefined;
    if (v === undefined) return [];
    const text = formatLayerValue(layer.axis, v, unit);
    return [`${layer.label} ${text}`];
  });
  return parts.length > 0 ? parts.join(', ') : 'No readings yet';
}
