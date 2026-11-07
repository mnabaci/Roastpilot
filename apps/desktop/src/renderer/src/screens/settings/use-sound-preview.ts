import type { SoundStep, StepSound } from '@roastpilot/shared';
import { useEffect, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { createSoundRepeats } from '../../features/sound-repeats';
import { playStepSound } from '../../features/step-sound';

export interface SoundPreview {
  /** Plays are still to come. */
  previewing: boolean;
  /** Plays the step as set, repeats too. */
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
        sound,
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
