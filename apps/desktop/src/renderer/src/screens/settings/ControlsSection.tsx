import type { ControlsLevel } from '@roastpilot/shared';
import { SegmentedControl } from '@roastpilot/ui';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from './use-save-settings';
import { SettingCard, SettingRow } from './SettingRow';

const LEVELS: readonly { value: ControlsLevel; label: string; hint: string }[] = [
  {
    value: 'guided',
    label: 'Guided',
    hint: 'Heater only from Preheat to Drop · fan and cooling locked while the beans cool',
  },
  {
    value: 'full',
    label: 'Full control',
    hint: 'Heater, fan and cooling any time the roaster is connected',
  },
];

/** Guided or Full control (docs/spec/manual-mode.md). */
export function ControlsSection() {
  const level = useSettings((s) => s.settings.controls);
  const save = useSaveSettings();
  const current = LEVELS.find((l) => l.value === level);
  return (
    <SettingCard title="Controls">
      <SettingRow name="When you can use the controls" hint={current?.hint ?? ''}>
        <SegmentedControl
          label="Controls"
          options={LEVELS}
          value={level}
          onChange={(controls) => {
            save({ controls });
          }}
        />
      </SettingRow>
    </SettingCard>
  );
}
