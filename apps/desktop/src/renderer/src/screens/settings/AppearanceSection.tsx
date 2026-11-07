import type { Theme } from '@roastpilot/shared';
import { SegmentedControl } from '@roastpilot/ui';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from './use-save-settings';
import { SettingCard, SettingRow } from './SettingRow';

const OPTIONS: readonly { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Match system' },
];

/** How the app looks (docs/spec/ui.md, Settings). */
export function AppearanceSection() {
  const theme = useSettings((s) => s.settings.theme);
  const save = useSaveSettings();
  return (
    <SettingCard title="Appearance">
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
