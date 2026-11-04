import { ROASTER_COOL_C } from '@roastpilot/core';
import type { ReactNode } from 'react';
import type { CoolingTime } from '@roastpilot/shared';
import { useSettings } from '../../stores/use-stores';
import { Choice, type ChoiceOption } from './Choice';
import { useSaveSettings } from './use-save-settings';

const ON_OFF: readonly ChoiceOption<boolean>[] = [
  { id: true, label: 'On' },
  { id: false, label: 'Off' },
];

const COOLING_TIMES: readonly ChoiceOption<CoolingTime>[] = ([2, 3, 4, 5, 6] as const).map(
  (min) => ({ id: min, label: `${String(min)} min` }),
);

/** One roast setting: its name, its choice and one line on what it does. */
function Setting({ name, hint, children }: { name: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-body font-semibold">{name}</h3>
      {children}
      <p className="text-label text-ink-muted">{hint}</p>
    </div>
  );
}

/** Charge point, cooling time and roaster cool-down (docs/spec/manual-mode.md). */
export function RoastSection() {
  const settings = useSettings((s) => s.settings);
  const save = useSaveSettings();
  return (
    <section aria-labelledby="roast-heading" className="flex flex-col gap-4">
      <h2 id="roast-heading" className="text-heading">
        Roast
      </h2>
      <Setting
        name="Find the charge point"
        hint="Start pressed late? Charge moves back to the drop in temperature"
      >
        <Choice
          label="Find the charge point"
          options={ON_OFF}
          value={settings.findChargePoint}
          onChange={(on) => {
            save({ findChargePoint: on });
          }}
        />
      </Setting>
      <Setting
        name="Cooling time"
        hint="How long the beans cool in the tray · +1 min while cooling"
      >
        <Choice
          label="Cooling time"
          options={COOLING_TIMES}
          value={settings.coolingTimeMin}
          onChange={(min) => {
            save({ coolingTimeMin: min });
          }}
        />
      </Setting>
      <Setting
        name="Cool the roaster after each roast"
        hint={`Fan and drum keep running until the drum is below ${String(ROASTER_COOL_C)} °C`}
      >
        <Choice
          label="Cool the roaster after each roast"
          options={ON_OFF}
          value={settings.coolRoasterAfter}
          onChange={(on) => {
            save({ coolRoasterAfter: on });
          }}
        />
      </Setting>
    </section>
  );
}
