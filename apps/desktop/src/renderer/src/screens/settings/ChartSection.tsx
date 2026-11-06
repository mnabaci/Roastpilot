import type { ChartSmoothing } from '@roastpilot/shared';
import { SegmentedControl } from '@roastpilot/ui';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from './use-save-settings';
import { SettingCard, SettingRow } from './SettingRow';

const OPTIONS: readonly { value: ChartSmoothing; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 3, label: '3 s' },
  { value: 5, label: '5 s' },
  { value: 10, label: '10 s' },
];

/** How much the drawn temperature line is smoothed (docs/spec/ui.md, Temperature axis). */
export function ChartSection() {
  const smoothingS = useSettings((s) => s.settings.chartSmoothingS);
  const save = useSaveSettings();
  return (
    <SettingCard title="Chart">
      <SettingRow
        name="Temperature smoothing"
        hint="Smooths the temperature line · the big number stays the raw reading"
      >
        <SegmentedControl
          label="Temperature smoothing"
          options={OPTIONS}
          value={smoothingS}
          onChange={(chartSmoothingS) => {
            save({ chartSmoothingS });
          }}
        />
      </SettingRow>
    </SettingCard>
  );
}
