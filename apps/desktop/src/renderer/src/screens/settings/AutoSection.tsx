import { formatClock, SegmentedControl } from '@roastpilot/ui';
import type { SoakTime } from '@roastpilot/shared';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from './use-save-settings';
import { SettingCard, SettingRow } from './SettingRow';

const SOAK_TIMES: readonly SoakTime[] = [30, 45, 60, 75, 90, 120];

/** Auto's own settings (docs/spec/roast-control.md, Auto mode). */
export function AutoSection() {
  const soakTimeS = useSettings((s) => s.settings.soakTimeS);
  const save = useSaveSettings();
  return (
    <SettingCard title="Auto">
      <SettingRow name="Soak time" hint="Heater at 0 after charge · for every profile">
        <SegmentedControl
          label="Soak time"
          options={SOAK_TIMES.map((value) => ({ value, label: formatClock(value) }))}
          value={soakTimeS}
          onChange={(soak) => {
            save({ soakTimeS: soak });
          }}
        />
      </SettingRow>
    </SettingCard>
  );
}
