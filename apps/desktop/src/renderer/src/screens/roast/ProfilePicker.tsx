import { SelectField } from '@roastpilot/ui';
import { useSaveSettings } from '../settings/use-save-settings';
import { useAuto } from '../../stores/use-stores';
import { profileDetail } from './profile-detail';
import { useActiveProfile } from './use-active-profile';

/** The profile Auto runs, with a word when it still needs calibrating (docs/spec/roast-control.md). */
export function ProfilePicker() {
  const profiles = useAuto((s) => s.profiles);
  const active = useActiveProfile();
  const save = useSaveSettings();
  if (!active) return null;
  return (
    <>
      <SelectField
        label="Profile"
        value={active.profile.id}
        options={profiles.map(({ profile, builtIn }) => ({
          value: profile.id,
          label: profile.name,
          detail: profileDetail(profile, builtIn),
        }))}
        onChange={(autoProfile) => {
          save({ autoProfile });
        }}
      />
      {active.profile.needsCalibration ? (
        <p className="text-label text-ink-muted">Needs calibration · stay close.</p>
      ) : null}
    </>
  );
}
