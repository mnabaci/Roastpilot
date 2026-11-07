import type { SoundStep, StepSound } from '@roastpilot/shared';
import type { ChimePlayer } from './chime';
import { playTimesMs, type SoundRepeats } from './sound-repeats';
import { voiceLengthMs } from './voices';

/**
 * Plays a step's sound now and repeats it as set (docs/spec/ui.md, Sounds) while `waiting()`;
 * `onEnd` runs once no play is left to come, unless the step is stopped first.
 */
export function playStepSound(
  repeats: SoundRepeats,
  chime: ChimePlayer,
  step: SoundStep,
  { voice, volumePct, repeat }: StepSound,
  waiting: () => boolean,
  onEnd?: () => void,
): void {
  repeats.start(
    step,
    playTimesMs(repeat, voiceLengthMs(voice)),
    () => {
      chime.play(voice, volumePct);
    },
    waiting,
    onEnd,
  );
}
