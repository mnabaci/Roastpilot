import type { TemperatureUnit } from '@roastpilot/shared';
import { cn } from '../../lib/utils';
import type { LineLayer } from './chart-layer';
import { formatLayerValue, valueAt } from './value-at';

/**
 * Each layer's line sample and name; the outputs strip has its own, under the chart. With `at`
 * (hovering), each name is followed by its value at that time.
 */
export function Legend({
  label,
  layers,
  at,
  unit,
  className,
}: {
  label: string;
  layers: readonly LineLayer[];
  at: number | undefined;
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
          {at === undefined ? null : <LegendValue layer={layer} at={at} unit={unit} />}
        </li>
      ))}
    </ul>
  );
}

function LegendValue({ layer, at, unit }: { layer: LineLayer; at: number; unit: TemperatureUnit }) {
  const v = valueAt(layer, at);
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
