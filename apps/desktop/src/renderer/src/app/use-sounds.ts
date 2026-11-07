import { SoundStepSchema, type Sounds, type SoundStep, type StepSound } from '@roastpilot/shared';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { ChimePlayer } from '../features/chime';
import {
  expectedFirstCrackC,
  listenDue,
  stepsReached,
  stillWaiting,
  type WaitState,
} from '../features/sound-cues';
import { createSoundRepeats } from '../features/sound-repeats';
import { useRoastList } from '../screens/history/use-roast-list';
import { activeRoaster } from '../stores/roasters-store';
import type { Stores } from '../stores/stores';
import { useRoasters } from '../stores/use-stores';
import { useDeps } from './app-context';

const cueState = (stores: Stores): WaitState => ({
  roast: stores.roast.getState().roast,
  auto: stores.auto.getState().status,
});

const soundsOf = (stores: Stores): Sounds => stores.settings.getState().settings.sounds;

const sameSound = (a: StepSound, b: StepSound) =>
  a.voice === b.voice && a.volumePct === b.volumePct && a.repeat === b.repeat;

/**
 * Plays each step's sound when it is reached, then repeats it as set while the step still waits;
 * returns the unsubscribe that also cancels every repeat still to come.
 */
function playSounds(
  stores: Stores,
  chime: ChimePlayer,
  expected: RefObject<number | undefined>,
): () => void {
  const repeats = createSoundRepeats();
  let before = cueState(stores);
  let seen = soundsOf(stores);
  // The charge time of the roast already cued, so each roast hears it once.
  let listenedFor: number | null = null;
  const start = (step: SoundStep, { voice, volumePct, repeat }: StepSound) => {
    repeats.start(
      step,
      repeat,
      () => {
        chime.play(voice, volumePct);
      },
      () => stillWaiting(step, cueState(stores)),
    );
  };
  const check = () => {
    const after = cueState(stores);
    for (const step of SoundStepSchema.options) if (!stillWaiting(step, after)) repeats.stop(step);
    // Main's snapshot arriving isn't a change: a window opened mid-roast stays quiet.
    if (!stores.sync.getState().ready) {
      before = after;
      return;
    }
    const due: SoundStep[] = stepsReached(before, after);
    before = after;
    const { roast, readings } = stores.roast.getState();
    if (
      roast.chargedAtMs !== listenedFor &&
      listenDue(roast, readings.at(-1)?.values.bt, expected.current)
    ) {
      listenedFor = roast.chargedAtMs;
      due.push('listen-first-crack');
    }
    const sounds = soundsOf(stores);
    if (!sounds.enabled) return;
    for (const step of due) start(step, sounds.steps[step]);
  };
  // Sounds off, or a step's setting changed: its repeats stop at once.
  const settingsChanged = () => {
    const sounds = soundsOf(stores);
    if (!sounds.enabled) repeats.stopAll();
    for (const step of SoundStepSchema.options)
      if (!sameSound(sounds.steps[step], seen.steps[step])) repeats.stop(step);
    seen = sounds;
  };
  const stops = [
    stores.roast.subscribe(check),
    stores.auto.subscribe(check),
    stores.settings.subscribe(settingsChanged),
  ];
  return () => {
    for (const stop of stops) stop();
    repeats.stopAll();
  };
}

/**
 * Plays each step's sound (docs/spec/ui.md, Sounds): once per change, never per reading, repeated
 * as set while the step still waits, and nothing while Sounds is off. Mounted once, in the app
 * shell, so one window plays them.
 */
export function useSounds(): void {
  const { stores, chime } = useDeps();
  const roasts = useRoastList();
  const roasterId = useRoasters((s) => activeRoaster(s.roasters)?.id);
  const expectedC = useMemo(
    () => (roasts ? expectedFirstCrackC(roasts, roasterId) : undefined),
    [roasts, roasterId],
  );
  // Read by the store listener below, so a reloaded roast list doesn't restart it.
  const expected = useRef(expectedC);
  useEffect(() => {
    expected.current = expectedC;
  }, [expectedC]);

  useEffect(() => playSounds(stores, chime, expected), [stores, chime]);
}
