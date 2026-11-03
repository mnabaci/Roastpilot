import type { ControlsLevel } from '@roastpilot/shared';
import { Button } from '@roastpilot/ui';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from './use-save-settings';

const LEVELS: readonly { id: ControlsLevel; label: string; hint: string }[] = [
  { id: 'guided', label: 'Guided', hint: 'Heater and fan from Preheat until Drop' },
  { id: 'full', label: 'Full control', hint: 'Every output, any time, cooling switch included' },
];

/** Guided or Full control (docs/spec/manual-mode.md). */
export function ControlsSection() {
  const level = useSettings((s) => s.settings.controls);
  const save = useSaveSettings();
  const current = LEVELS.find((l) => l.id === level);
  return (
    <section aria-labelledby="controls-heading" className="flex flex-col gap-3">
      <h2 id="controls-heading" className="text-heading">
        Controls
      </h2>
      <div role="group" aria-label="Controls" className="flex gap-2">
        {LEVELS.map(({ id, label }) => (
          <Button
            key={id}
            aria-pressed={level === id}
            className={level === id ? 'bg-heat-tint text-heat' : undefined}
            onClick={() => {
              save({ controls: id });
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-label text-ink-muted">{current?.hint}</p>
    </section>
  );
}
