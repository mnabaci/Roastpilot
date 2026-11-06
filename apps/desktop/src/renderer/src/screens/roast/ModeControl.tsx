import type { RoastMode } from '@roastpilot/shared';
import { SegmentedControl, SelectField } from '@roastpilot/ui';
import { useSaveSettings } from '../settings/use-save-settings';
import { useAuto, useSettings } from '../../stores/use-stores';
import { useActiveProfile, useProfileLocked } from './use-active-profile';

const MODES: readonly { value: RoastMode; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'auto', label: 'Auto' },
];

/**
 * Who drives the roast, and with which profile (docs/spec/roast-control.md, Auto mode). The switch
 * stays live mid-roast; the profile picker only shows before one, as it can't change after.
 */
export function ModeControl({ withProfile }: { withProfile: boolean }) {
  const mode = useSettings((s) => s.settings.roastMode);
  const profiles = useAuto((s) => s.profiles);
  const active = useActiveProfile();
  const save = useSaveSettings();
  const locked = useProfileLocked();
  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        label="Roast mode"
        className="self-start"
        options={MODES}
        value={mode}
        onChange={(roastMode) => {
          save({ roastMode });
        }}
      />
      {withProfile && mode === 'auto' && active ? (
        <>
          <SelectField
            label="Profile"
            disabled={locked}
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
    </div>
  );
}
