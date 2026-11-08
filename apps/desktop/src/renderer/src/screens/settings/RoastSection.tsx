import { formatPlainTemp, type CoolingTime, type RoasterCoolTo } from '@roastpilot/shared';
import { SegmentedControl, Switch, type SegmentedOption } from '@roastpilot/ui';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from './use-save-settings';
import { SettingCard, SettingRow } from './SettingRow';

const COOLING_TIMES: readonly SegmentedOption<CoolingTime>[] = ([2, 3, 4, 5, 6] as const).map(
  (min) => ({ value: min, label: `${String(min)} min` }),
);

const ROASTER_COOL_TO = [40, 50, 60, 70] as const;

/** Charge point, the coach, bean cooling and drum cooling (docs/spec/manual-mode.md). */
export function RoastSection() {
  const settings = useSettings((s) => s.settings);
  const save = useSaveSettings();
  const unit = useTemperatureUnit();
  // The choices stay the °C steps; °F names them as they are (50 °C is 122 °F).
  const coolTo: readonly SegmentedOption<RoasterCoolTo>[] = ROASTER_COOL_TO.map((c) => ({
    value: c,
    label: formatPlainTemp(c, unit),
  }));
  return (
    <SettingCard title="Roast">
      <SettingRow
        name="Find the charge point"
        hint="Start pressed late? Charge moves back to the drop in temperature"
      >
        <Switch
          aria-label="Find the charge point"
          checked={settings.findChargePoint}
          onChange={(on) => {
            save({ findChargePoint: on });
          }}
        />
      </SettingRow>
      <SettingRow name="Coach in manual roasts" hint="Suggests what Auto would set now, with Apply">
        <Switch
          aria-label="Coach in manual roasts"
          checked={settings.coachInManual}
          onChange={(on) => {
            save({ coachInManual: on });
          }}
        />
      </SettingRow>
      <SettingRow
        name="Cool the beans for"
        hint="How long the beans cool in the tray · +1 min while cooling"
      >
        <SegmentedControl
          label="Cool the beans for"
          options={COOLING_TIMES}
          value={settings.coolingTimeMin}
          onChange={(min) => {
            save({ coolingTimeMin: min });
          }}
        />
      </SettingRow>
      <SettingRow
        name="Cool the drum after each roast"
        hint="From Drop, fan and drum run until the drum is cool"
      >
        <Switch
          aria-label="Cool the drum after each roast"
          checked={settings.coolRoasterAfter}
          onChange={(on) => {
            save({ coolRoasterAfter: on });
          }}
        />
      </SettingRow>
      {settings.coolRoasterAfter ? (
        <SettingRow name="Cool the drum to" hint="Drum cooling stops below this · at most 20 min">
          <SegmentedControl
            label="Cool the drum to"
            options={coolTo}
            value={settings.roasterCoolToC}
            onChange={(c) => {
              save({ roasterCoolToC: c });
            }}
          />
        </SettingRow>
      ) : null}
    </SettingCard>
  );
}
