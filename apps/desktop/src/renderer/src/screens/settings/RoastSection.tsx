import type { CoolingBelow, CoolingEnd, CoolingTime, RoasterCoolTo } from '@roastpilot/shared';
import { SegmentedControl, Switch, type SegmentedOption } from '@roastpilot/ui';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from './use-save-settings';
import { SettingCard, SettingRow } from './SettingRow';

const COOLING_ENDS: readonly SegmentedOption<CoolingEnd>[] = [
  { value: 'time', label: 'By time' },
  { value: 'temperature', label: 'By temperature' },
];

const COOLING_TIMES: readonly SegmentedOption<CoolingTime>[] = ([2, 3, 4, 5, 6] as const).map(
  (min) => ({ value: min, label: `${String(min)} min` }),
);

const degrees = <T extends number>(values: readonly T[]): readonly SegmentedOption<T>[] =>
  values.map((c) => ({ value: c, label: `${String(c)} °C` }));
const COOLING_BELOW = degrees<CoolingBelow>([70, 80, 90, 100]);
const ROASTER_COOL_TO = degrees<RoasterCoolTo>([40, 50, 60, 70]);

/** Charge point, when bean cooling ends and the roaster cool-down (docs/spec/manual-mode.md). */
export function RoastSection() {
  const settings = useSettings((s) => s.settings);
  const save = useSaveSettings();
  const byTime = settings.coolingEnd === 'time';
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
      <SettingRow
        name="Cooling ends"
        hint={
          byTime
            ? 'How long the beans cool in the tray · +1 min while cooling'
            : 'When the drum probe drops below this · at most 10 min'
        }
      >
        <SegmentedControl
          label="Cooling ends"
          options={COOLING_ENDS}
          value={settings.coolingEnd}
          onChange={(end) => {
            save({ coolingEnd: end });
          }}
        />
        {byTime ? (
          <SegmentedControl
            label="Cooling time"
            options={COOLING_TIMES}
            value={settings.coolingTimeMin}
            onChange={(min) => {
              save({ coolingTimeMin: min });
            }}
          />
        ) : (
          <SegmentedControl
            label="Cool until below"
            options={COOLING_BELOW}
            value={settings.coolingBelowC}
            onChange={(c) => {
              save({ coolingBelowC: c });
            }}
          />
        )}
      </SettingRow>
      <SettingRow
        name="Cool the roaster after each roast"
        hint="Fan and drum keep running after the beans cool, until the drum is cool"
      >
        <Switch
          aria-label="Cool the roaster after each roast"
          checked={settings.coolRoasterAfter}
          onChange={(on) => {
            save({ coolRoasterAfter: on });
          }}
        />
      </SettingRow>
      {settings.coolRoasterAfter ? (
        <SettingRow
          name="Cool the roaster to"
          hint="The roaster cool-down stops below this · at most 15 min"
        >
          <SegmentedControl
            label="Cool the roaster to"
            options={ROASTER_COOL_TO}
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
