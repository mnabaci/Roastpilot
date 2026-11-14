import type { Tc4Wiring } from '@roastpilot/shared';
import { SegmentedControl, SelectField, type SegmentedOption } from '@roastpilot/ui';
import { SettingRow } from '../settings/SettingRow';
import {
  baudOf,
  baudOptions,
  btOptions,
  etOptions,
  isInput,
  minFanOptions,
  withBt,
  withFan,
  withHeater,
} from './wiring-choices';

const HEATER_OUTPUTS: readonly SegmentedOption<Tc4Wiring['heaterOutput']>[] = [
  { value: 'OT1', label: 'OT1' },
  { value: 'IO3', label: 'IO3' },
];

/** Heater and fan never share IO3: picking it for one moves the other (wiring-choices.ts). */
const FAN_OUTPUTS: readonly SegmentedOption<Tc4Wiring['fanOutput']>[] = [
  { value: 'OT2', label: 'OT2 · AC fan' },
  { value: 'IO3', label: 'IO3 · DC fan' },
];

/** The wiring card's setting rows: each saves as you pick, each with a one-line hint. */
export function WiringRows({
  wiring,
  minFanHeatingPct,
  disabled,
  save,
}: {
  wiring: Tc4Wiring;
  minFanHeatingPct: number;
  disabled: boolean;
  save: (wiring: Tc4Wiring, minFanHeatingPct?: number) => void;
}) {
  return (
    <div className="flex flex-col">
      <SettingRow name="Bean probe (BT)" hint="The thermocouple in the beans">
        <SelectField
          label="Bean probe (BT)"
          hideLabel
          numeric
          value={String(wiring.btInput)}
          options={btOptions}
          disabled={disabled}
          onChange={(value) => {
            const input = Number(value);
            if (isInput(input)) save(withBt(wiring, input));
          }}
        />
      </SettingRow>
      <SettingRow
        name="Environment probe (ET)"
        hint="The air around the beans · None without an ET probe"
      >
        <SelectField
          label="Environment probe (ET)"
          hideLabel
          numeric
          value={String(wiring.etInput)}
          options={etOptions(wiring)}
          disabled={disabled}
          onChange={(value) => {
            // 0 is no ET probe.
            const input = Number(value);
            if (input === 0 || isInput(input)) save({ ...wiring, etInput: input });
          }}
        />
      </SettingRow>
      <SettingRow name="Heater output" hint="Where the heater's relay is wired">
        <SegmentedControl
          label="Heater output"
          options={HEATER_OUTPUTS}
          value={wiring.heaterOutput}
          disabled={disabled}
          onChange={(output) => {
            save(withHeater(wiring, output));
          }}
        />
      </SettingRow>
      <SettingRow name="Fan output" hint="Where the fan is wired">
        <SegmentedControl
          label="Fan output"
          options={FAN_OUTPUTS}
          value={wiring.fanOutput}
          disabled={disabled}
          onChange={(output) => {
            save(withFan(wiring, output));
          }}
        />
      </SettingRow>
      <SettingRow name="Baud" hint="The board's serial speed · 115,200 unless you changed it">
        <SelectField
          label="Baud"
          hideLabel
          numeric
          value={String(wiring.baud)}
          options={baudOptions}
          disabled={disabled}
          onChange={(value) => {
            const baud = baudOf(value);
            if (baud) save({ ...wiring, baud });
          }}
        />
      </SettingRow>
      <SettingRow
        name="Minimum fan while heating"
        hint="Air roasters burn out their heater without it · Off for drum roasters"
      >
        <SelectField
          label="Minimum fan while heating"
          hideLabel
          numeric
          value={String(minFanHeatingPct)}
          options={minFanOptions}
          disabled={disabled}
          onChange={(value) => {
            const pct = Number(value);
            if (Number.isFinite(pct)) save(wiring, pct);
          }}
        />
      </SettingRow>
    </div>
  );
}
