import type { TemperatureUnit, Theme } from '@roastpilot/shared';
import { SegmentedControl } from '@roastpilot/ui';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from './use-save-settings';
import { SettingCard, SettingRow } from './SettingRow';

const UNITS: readonly { value: TemperatureUnit; label: string }[] = [
  { value: 'c', label: '°C' },
  { value: 'f', label: '°F' },
];

const OPTIONS: readonly { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Match system' },
];

/** What temperatures are shown in, and how the app looks (docs/spec/ui.md, Settings and Units). */
export function AppearanceSection() {
  const unit = useSettings((s) => s.settings.temperatureUnit);
  const theme = useSettings((s) => s.settings.theme);
  const save = useSaveSettings();
  return (
    <SettingCard title="Appearance">
      <SettingRow name="Temperature" hint="What you see and type · roasts are kept in °C">
        <SegmentedControl
          label="Temperature"
          options={UNITS}
          value={unit}
          onChange={(next) => {
            save({ temperatureUnit: next });
          }}
        />
      </SettingRow>
      <SettingRow name="Theme" hint="Match system follows your computer">
        <SegmentedControl
          label="Theme"
          options={OPTIONS}
          value={theme}
          onChange={(next) => {
            save({ theme: next });
          }}
        />
      </SettingRow>
    </SettingCard>
  );
}
