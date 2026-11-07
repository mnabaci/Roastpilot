import {
  DEFAULT_STEP_SOUNDS,
  SoundRepeatSchema,
  SoundVoiceSchema,
  type SoundRepeat,
  type SoundStep,
  type StepSound,
} from '@roastpilot/shared';
import { Button, cn, OutputControl, SelectField } from '@roastpilot/ui';
import { Play, RotateCcw, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { createSoundRepeats, playTimesMs } from '../../features/sound-repeats';
import { LISTEN_BEFORE_C } from '../../features/sound-cues';
import { VOICE_LABEL, voiceLengthMs } from '../../features/voices';
import { SettingRow } from './SettingRow';

/** Each step's name in Settings, and when it plays. */
const STEP: Readonly<Record<SoundStep, { name: string; hint: string }>> = {
  'charge-soon': { name: 'Charge soon', hint: "Auto's preheat is ready for the beans" },
  'beans-in': { name: 'Beans in', hint: 'Auto says put the beans in now' },
  'dump-beans': { name: 'Dump beans', hint: 'The roast dropped · dump the beans to cool' },
  'listen-first-crack': {
    name: 'Listen for first crack',
    hint: `${String(LISTEN_BEFORE_C)} °C before your usual first-crack temperature`,
  },
  'auto-stopped': {
    name: 'Auto stopped',
    hint: 'Auto handed you the controls · not on safety stops',
  },
};

const VOICES = SoundVoiceSchema.options.map((voice) => ({
  value: voice,
  label: VOICE_LABEL[voice],
}));

/** What the repeat choices are called in Settings. */
const REPEAT_LABEL: Readonly<Record<SoundRepeat, string>> = {
  once: 'Once',
  twice: '2 times',
  thrice: '3 times',
  'until-done': 'Until done',
};

const REPEATS = SoundRepeatSchema.options.map((repeat) => ({
  value: repeat,
  label: REPEAT_LABEL[repeat],
}));

/** One step's sound: voice, repeat, volume, a preview, and Reset while it differs from the default. */
export function SoundStepRow({
  step,
  sound,
  onChange,
}: {
  step: SoundStep;
  sound: StepSound;
  onChange: (sound: StepSound) => void;
}) {
  const { chime } = useDeps();
  const { name, hint } = STEP[step];
  // Play previews the step as set, repeats too; Stop, leaving Settings or a change stops it.
  const [preview] = useState(createSoundRepeats);
  const [previewing, setPreviewing] = useState(false);
  const stopPreview = () => {
    preview.stopAll();
    setPreviewing(false);
  };
  const change = (next: StepSound) => {
    stopPreview();
    onChange(next);
  };
  const { voice, volumePct, repeat } = sound;
  useEffect(
    () => () => {
      preview.stopAll();
    },
    [preview],
  );
  const startPreview = () => {
    setPreviewing(true);
    preview.start(
      step,
      playTimesMs(repeat, voiceLengthMs(voice)),
      () => {
        chime.play(voice, volumePct);
      },
      () => true,
      () => {
        setPreviewing(false);
      },
    );
  };
  const fallback = DEFAULT_STEP_SOUNDS[step];
  const changed =
    sound.voice !== fallback.voice ||
    sound.volumePct !== fallback.volumePct ||
    sound.repeat !== fallback.repeat;
  return (
    <SettingRow name={name} hint={hint} group>
      <div className="flex flex-wrap items-end justify-end gap-3">
        <SelectField
          label="Voice"
          value={sound.voice}
          options={VOICES}
          className="w-36"
          onChange={(voice) => {
            change({ ...sound, voice });
          }}
        />
        <SelectField
          label="Repeat"
          value={sound.repeat}
          options={REPEATS}
          className="w-36"
          onChange={(repeat) => {
            change({ ...sound, repeat });
          }}
        />
        <OutputControl
          label="Volume"
          tone="neutral"
          value={sound.volumePct}
          className="w-44"
          onChange={(volumePct) => {
            change({ ...sound, volumePct });
          }}
        />
        {/* One button that turns into Stop while repeats are still to come, so focus stays on it. */}
        <Button
          size="sm"
          aria-label={`${previewing ? 'Stop' : 'Play'} ${name}`}
          icon={previewing ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
          onClick={previewing ? stopPreview : startPreview}
        />
        {/* Always takes its place, so changing a value never reflows the row; hidden at default. */}
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Reset ${name} to default`}
          title="Reset to default"
          icon={<RotateCcw aria-hidden="true" />}
          disabled={!changed}
          aria-hidden={!changed}
          tabIndex={changed ? undefined : -1}
          className={cn(!changed && 'invisible')}
          onClick={() => {
            change({ ...fallback });
          }}
        />
      </div>
    </SettingRow>
  );
}
