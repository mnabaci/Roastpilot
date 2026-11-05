import type { RoastMode } from '@roastpilot/shared';
import { SelectField } from '@roastpilot/ui';
import { Choice } from '../settings/Choice';
import { useSaveSettings } from '../settings/use-save-settings';
import { useAuto, useSettings } from '../../stores/use-stores';
import { useActiveProfile } from './use-active-profile';

const MODES: readonly { id: RoastMode; label: string }[] = [
  { id: 'manual', label: 'Manual' },
  { id: 'auto', label: 'Auto' },
];

/** Who drives the roast, and with which profile (docs/spec/roast-control.md, Auto mode). */
export function AutoPanel() {
  const mode = useSettings((s) => s.settings.roastMode);
  const profiles = useAuto((s) => s.profiles);
  const active = useActiveProfile();
  const save = useSaveSettings();
  return (
    <section aria-label="Roast mode" className="flex flex-col gap-2">
      <Choice
        label="Roast mode"
        options={MODES}
        value={mode}
        onChange={(roastMode) => {
          save({ roastMode });
        }}
      />
      {mode === 'auto' && active ? (
        <>
          <SelectField
            label="Profile"
            value={active.profile.id}
            options={profiles.map(({ profile }) => ({ value: profile.id, label: profile.name }))}
            onChange={(autoProfile) => {
              save({ autoProfile });
            }}
          />
          {active.profile.needsCalibration ? (
            <p className="text-label text-ink-muted">Needs calibration · stay close.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
