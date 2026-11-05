import type { ReactNode } from 'react';
import type { CoolingBelow, CoolingEnd, CoolingTime, RoasterCoolTo } from '@roastpilot/shared';
import { useSettings } from '../../stores/use-stores';
import { Choice, type ChoiceOption } from './Choice';
import { useSaveSettings } from './use-save-settings';

const ON_OFF: readonly ChoiceOption<boolean>[] = [
  { id: true, label: 'On' },
  { id: false, label: 'Off' },
];

const COOLING_ENDS: readonly ChoiceOption<CoolingEnd>[] = [
  { id: 'time', label: 'By time' },
  { id: 'temperature', label: 'By temperature' },
];

const COOLING_TIMES: readonly ChoiceOption<CoolingTime>[] = ([2, 3, 4, 5, 6] as const).map(
  (min) => ({ id: min, label: `${String(min)} min` }),
);

const degrees = <T extends number>(values: readonly T[]): readonly ChoiceOption<T>[] =>
  values.map((c) => ({ id: c, label: `${String(c)} °C` }));
const COOLING_BELOW = degrees<CoolingBelow>([70, 80, 90, 100]);
const ROASTER_COOL_TO = degrees<RoasterCoolTo>([40, 50, 60, 70]);

/** One roast setting: its name, its choices and one line on what it does. */
function Setting({ name, hint, children }: { name: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-body font-semibold">{name}</h3>
      {children}
      <p className="text-label text-ink-muted">{hint}</p>
    </div>
  );
}

/** Charge point, when bean cooling ends and the roaster cool-down (docs/spec/manual-mode.md). */
export function RoastSection() {
  const settings = useSettings((s) => s.settings);
  const save = useSaveSettings();
  const byTime = settings.coolingEnd === 'time';
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
        name="Cooling ends"
        hint={
          byTime
            ? 'How long the beans cool in the tray · +1 min while cooling'
            : 'When the drum probe drops below this · at most 10 min'
        }
      >
        <Choice
          label="Cooling ends"
          options={COOLING_ENDS}
          value={settings.coolingEnd}
          onChange={(end) => {
            save({ coolingEnd: end });
          }}
        />
        {byTime ? (
          <Choice
            label="Cooling time"
            options={COOLING_TIMES}
            value={settings.coolingTimeMin}
            onChange={(min) => {
              save({ coolingTimeMin: min });
            }}
          />
        ) : (
          <Choice
            label="Cool until below"
            options={COOLING_BELOW}
            value={settings.coolingBelowC}
            onChange={(c) => {
              save({ coolingBelowC: c });
            }}
          />
        )}
      </Setting>
      <Setting
        name="Cool the roaster after each roast"
        hint="Fan and drum keep running after the beans cool, until the drum is cool"
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
      <Setting
        name="Cool the roaster to"
        hint="The roaster cool-down stops below this · at most 15 min"
      >
        <Choice
          label="Cool the roaster to"
          options={ROASTER_COOL_TO}
          value={settings.roasterCoolToC}
          onChange={(c) => {
            save({ roasterCoolToC: c });
          }}
        />
      </Setting>
    </section>
  );
}
