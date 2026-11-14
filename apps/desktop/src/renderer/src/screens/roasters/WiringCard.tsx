import {
  isRoastRunning,
  tempNumber,
  tempSymbol,
  type Roaster,
  type Tc4Wiring,
} from '@roastpilot/shared';
import { SegmentedControl, SelectField, type SegmentedOption } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { useConnection, useRoast } from '../../stores/use-stores';
import { SettingRow } from '../settings/SettingRow';
import { useLiveInputs } from './use-live-inputs';
import {
  baudOf,
  baudOptions,
  btOptions,
  etOptions,
  inputRole,
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

/**
 * A generic TC4's wiring (docs/spec/roasters.md, Generic TC4): setting rows that save as you pick,
 * also while connected, so a probe can be picked by its live reading. A connected roaster
 * reconnects with the new wiring; nothing changes while a roast runs.
 */
export function WiringCard({ roaster }: { roaster: Roaster & { wiring: Tc4Wiring } }) {
  const { api, logger } = useDeps();
  const run = useRun();
  const unit = useTemperatureUnit();
  const roasting = useRoast((s) => isRoastRunning(s.roast));
  const connected = useConnection((s) => s.connection.status === 'connected') && roaster.active;
  const live = useLiveInputs(connected && !roasting);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string>();
  const { wiring } = roaster;
  const save = (next: Tc4Wiring, minFanHeatingPct = roaster.minFanHeatingPct) => {
    setProblem(undefined);
    setSaving(true);
    run(
      'roasters.wiring-save-failed',
      async () => {
        try {
          const saved = await api.saveRoasterWiring({
            id: roaster.id,
            wiring: next,
            minFanHeatingPct,
          });
          if (saved.ok) return;
          logger.warn('roasters.refused', { ...saved.error });
          setProblem(
            saved.error.kind === 'roasting'
              ? 'Waits until the roast ends'
              : "Couldn't save the wiring · see the log",
          );
        } finally {
          setSaving(false);
        }
      },
      { failed: "Couldn't save the wiring · try again" },
    );
  };
  const disabled = roasting || saving;
  return (
    <section aria-label="Wiring" className="flex flex-col rounded-xl bg-surface px-5 pt-4">
      <h3 className="text-heading">Wiring</h3>
      <p className="text-label text-ink-muted">
        {roasting
          ? 'Waits until the roast ends'
          : connected
            ? 'Saves as you pick · reconnects the roaster'
            : 'Saves as you pick'}
      </p>
      {problem ? (
        <p role="alert" className="pt-2 text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      {connected && !roasting ? (
        <div className="flex flex-col gap-2 pt-4">
          <ul aria-label="Inputs now" className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((input, i) => {
              const value = live.inputs?.[i];
              const role = inputRole(wiring, input);
              return (
                <li
                  key={input}
                  className="flex flex-col gap-0.5 rounded-lg bg-surface-raised px-3 py-2"
                >
                  <span className="text-label text-ink-muted">TC{String(input)}</span>
                  <span className="text-heading tabular-nums">
                    {value == null ? '—' : `${tempNumber(value, unit, 1)} ${tempSymbol(unit)}`}
                  </span>
                  <span className="text-label text-ink-muted">{role ?? ' '}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-label text-ink-muted">
            {live.problem ?? 'Warm a probe in your hand to see which it is'}
          </p>
        </div>
      ) : null}
      <div className="flex flex-col pt-2">
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
          hint="The air around the beans · None if there is none"
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
        <SettingRow name="Fan output" hint="OT2 for an AC fan, IO3 for a DC fan">
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
          hint="For air roasters · the heater never runs with less"
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
      </div>
    </section>
  );
}
