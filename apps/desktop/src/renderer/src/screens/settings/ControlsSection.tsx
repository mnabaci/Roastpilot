import type { ControlsLevel } from '@roastpilot/shared';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from './use-save-settings';
import { Choice } from './Choice';

const LEVELS: readonly { id: ControlsLevel; label: string; hint: string }[] = [
  {
    id: 'guided',
    label: 'Guided',
    hint: 'Heater from Preheat until Drop · the rest any time no roast runs',
  },
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
      <Choice
        label="Controls"
        options={LEVELS}
        value={level}
        onChange={(id) => {
          save({ controls: id });
        }}
      />
      <p className="text-label text-ink-muted">{current?.hint}</p>
    </section>
  );
}
