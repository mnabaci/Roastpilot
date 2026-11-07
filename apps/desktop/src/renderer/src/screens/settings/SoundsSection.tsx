import { SoundStepSchema, type SoundStep, type StepSound } from '@roastpilot/shared';
import { Switch } from '@roastpilot/ui';
import { useSettings } from '../../stores/use-stores';
import { SettingCard, SettingRow } from './SettingRow';
import { SoundStepRow } from './SoundStepRow';
import { useSaveSettings } from './use-save-settings';

/** Sounds on or off, then each step's voice and volume (docs/spec/ui.md, Sounds). */
export function SoundsSection() {
  const sounds = useSettings((s) => s.settings.sounds);
  const save = useSaveSettings();
  const saveStep = (step: SoundStep, sound: StepSound) => {
    save({ sounds: { ...sounds, steps: { ...sounds.steps, [step]: sound } } });
  };
  return (
    <SettingCard title="Sounds">
      <SettingRow name="Sounds" hint="A chime when something needs you, and before first crack">
        <Switch
          aria-label="Sounds"
          checked={sounds.enabled}
          onChange={(enabled) => {
            save({ sounds: { ...sounds, enabled } });
          }}
        />
      </SettingRow>
      {sounds.enabled
        ? SoundStepSchema.options.map((step) => (
            <SoundStepRow
              key={step}
              step={step}
              sound={sounds.steps[step]}
              onChange={(sound) => {
                saveStep(step, sound);
              }}
            />
          ))
        : null}
    </SettingCard>
  );
}
