import type { SoundStep, StepSound } from '@roastpilot/shared';
import { useEffect, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { createSoundRepeats } from '../../features/sound-repeats';
import { playStepSound } from '../../features/step-sound';

export interface SoundPreview {
  /** Plays are still to come. */
  previewing: boolean;
  /** Plays the step as set, counted repeats too; Until done plays once. */
  start: () => void;
  stop: () => void;
}

/** Settings' Play for one step: Stop, leaving Settings or the row's own change stops it. */
export function useSoundPreview(step: SoundStep, sound: StepSound): SoundPreview {
  const { chime } = useDeps();
  const [repeats] = useState(createSoundRepeats);
  const [previewing, setPreviewing] = useState(false);
  useEffect(
    () => () => {
      repeats.stopAll();
    },
    [repeats],
  );
  return {
    previewing,
    start: () => {
      setPreviewing(true);
      playStepSound(
        repeats,
        chime,
        step,
        // Until done repeats for a minute while a step waits; a preview only needs to be heard.
        sound.repeat === 'until-done' ? { ...sound, repeat: 'once' } : sound,
        () => true,
        () => {
          setPreviewing(false);
        },
      );
    },
    stop: () => {
      repeats.stopAll();
      setPreviewing(false);
    },
  };
}
