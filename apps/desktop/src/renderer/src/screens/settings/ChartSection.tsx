import type { ChartSmoothing } from '@roastpilot/shared';
import { Button } from '@roastpilot/ui';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from './use-save-settings';

const OPTIONS: readonly { id: ChartSmoothing; label: string }[] = [
  { id: 0, label: 'Off' },
  { id: 5, label: '5 s' },
  { id: 10, label: '10 s' },
];

/** How much the drawn temperature line is smoothed (docs/spec/ui.md, Temperature axis). */
export function ChartSection() {
  const smoothingS = useSettings((s) => s.settings.chartSmoothingS);
  const save = useSaveSettings();
  return (
    <section aria-labelledby="chart-heading" className="flex flex-col gap-3">
      <h2 id="chart-heading" className="text-heading">
        Chart
      </h2>
      <div role="group" aria-label="Temperature smoothing" className="flex gap-2">
        {OPTIONS.map(({ id, label }) => (
          <Button
            key={id}
            aria-pressed={smoothingS === id}
            className={smoothingS === id ? 'bg-heat-tint text-heat' : undefined}
            onClick={() => {
              save({ chartSmoothingS: id });
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-label text-ink-muted">
        Smooths the temperature line · the big number stays the raw reading
      </p>
    </section>
  );
}
