import type { ChartSmoothing } from '@roastpilot/shared';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from './use-save-settings';
import { Choice } from './Choice';

const OPTIONS: readonly { id: ChartSmoothing; label: string }[] = [
  { id: 0, label: 'Off' },
  { id: 3, label: '3 s' },
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
      <Choice
        label="Temperature smoothing"
        options={OPTIONS}
        value={smoothingS}
        onChange={(id) => {
          save({ chartSmoothingS: id });
        }}
      />
      <p className="text-label text-ink-muted">
        Smooths the temperature line · the big number stays the raw reading
      </p>
    </section>
  );
}
