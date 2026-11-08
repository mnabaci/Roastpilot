import type { ChartSmoothing, Settings } from '@roastpilot/shared';
import { SegmentedControl, Switch } from '@roastpilot/ui';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from './use-save-settings';
import { SettingRow, SettingRows, SettingSection } from './SettingRow';

const OPTIONS: readonly { value: ChartSmoothing; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 3, label: '3 s' },
  { value: 5, label: '5 s' },
  { value: 10, label: '10 s' },
];

type AidKey = 'chartProjection' | 'chartNowLine' | 'chartTemperatureFocus' | 'chartPhaseBands';

/** The chart's four aids during a roast, each with its one-line hint (docs/spec/ui.md, Settings). */
const AIDS: readonly { key: AidKey; name: string; hint: string }[] = [
  {
    key: 'chartProjection',
    name: 'Projection',
    hint: 'Where the temperature is heading at this RoR',
  },
  { key: 'chartNowLine', name: 'Now line', hint: 'A line at the current time' },
  {
    key: 'chartTemperatureFocus',
    name: 'Temperature focus',
    hint: 'Temperature axis fitted to the roast',
  },
  {
    key: 'chartPhaseBands',
    name: 'Phase bands',
    hint: 'Drying, Maillard and development behind the curve',
  },
];

/**
 * How the drawn temperature line is smoothed (docs/spec/ui.md, Temperature axis), then the aids the
 * chart shows during a roast.
 */
export function ChartSection() {
  const settings: Settings = useSettings((s) => s.settings);
  const save = useSaveSettings();
  return (
    <SettingSection title="Chart">
      <SettingRows>
        <SettingRow
          name="Temperature smoothing"
          hint="Smooths the temperature line · the big number stays the raw reading"
        >
          <SegmentedControl
            label="Temperature smoothing"
            options={OPTIONS}
            value={settings.chartSmoothingS}
            onChange={(chartSmoothingS) => {
              save({ chartSmoothingS });
            }}
          />
        </SettingRow>
      </SettingRows>
      <SettingRows title="During a roast">
        {AIDS.map(({ key, name, hint }) => (
          <SettingRow key={key} name={name} hint={hint}>
            <Switch
              aria-label={name}
              checked={settings[key]}
              onChange={(on) => {
                save({ [key]: on });
              }}
            />
          </SettingRow>
        ))}
      </SettingRows>
    </SettingSection>
  );
}
