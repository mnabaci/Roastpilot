import { isRoastRunning, type Roaster, type Tc4Wiring } from '@roastpilot/shared';
import { SegmentedControl, SelectField, type SegmentedOption } from '@roastpilot/ui';
import { activeRoaster } from '../../stores/roasters-store';
import { useConnection, useRoast, useRoasters } from '../../stores/use-stores';
import { SettingRow, SettingRows } from '../settings/SettingRow';
import { LiveInputs } from './LiveInputs';
import { useLiveInputs } from './use-live-inputs';
import { useSaveWiring } from './use-save-wiring';
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
import { isWaiting, wiringStatus, wiringWait } from './wiring-status';

const HEATER_OUTPUTS: readonly SegmentedOption<Tc4Wiring['heaterOutput']>[] = [
  { value: 'OT1', label: 'OT1' },
  { value: 'IO3', label: 'IO3' },
];

/** Heater and fan never share IO3: picking it for one moves the other (wiring-choices.ts). */
const FAN_OUTPUTS: readonly SegmentedOption<Tc4Wiring['fanOutput']>[] = [
  { value: 'OT2', label: 'OT2 · AC fan' },
  { value: 'IO3', label: 'IO3 · DC fan' },
];

/**
 * A generic TC4's wiring (docs/spec/roasters.md, Generic TC4): setting rows that save as you pick,
 * also while connected, so a probe can be picked by its live reading. A connected roaster
 * reconnects with the new wiring; nothing changes while a roast or drum cooling runs.
 */
export function WiringCard({ roaster }: { roaster: Roaster & { wiring: Tc4Wiring } }) {
  const active = useRoasters((s) => activeRoaster(s.roasters));
  const busy = useRoast((s) => isRoastRunning(s.roast));
  const wait = wiringWait(
    useRoast((s) => s.roast),
    busy && active && active.id !== roaster.id ? active.name : undefined,
  );
  const connected = useConnection((s) => s.connection.status === 'connected') && roaster.active;
  // Connecting, or lost and retrying: a save reconnects then too.
  const inUse = useConnection((s) => s.connection.status !== 'disconnected') && roaster.active;
  const live = useLiveInputs(connected && !busy);
  const { save, saving, problem } = useSaveWiring(roaster);
  const { wiring } = roaster;
  const disabled = isWaiting(wait) || saving;
  return (
    <SettingRows title="Wiring" hint={wiringStatus(wait, inUse)}>
      {problem ? (
        <p role="alert" className="pt-2 text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      {connected && !busy ? (
        <LiveInputs wiring={wiring} inputs={live.inputs} problem={live.problem} />
      ) : null}
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
            save({ ...wiring, etInput: Number(value) });
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
          value={String(roaster.minFanHeatingPct)}
          options={minFanOptions}
          disabled={disabled}
          onChange={(value) => {
            save(wiring, Number(value));
          }}
        />
      </SettingRow>
    </SettingRows>
  );
}
