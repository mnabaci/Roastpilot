import { sameStepSound, SoundStepSchema, type Sounds, type SoundStep } from '@roastpilot/shared';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { ChimePlayer } from '../features/chime';
import {
  expectedFirstCrackC,
  listenDue,
  stepsReached,
  stillWaiting,
  type WaitState,
} from '../features/sound-cues';
import { createSoundRepeats, type SoundRepeats } from '../features/sound-repeats';
import { playStepSound } from '../features/step-sound';
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

/**
 * The steps each store change has just reached, the listen cue once per roast among them. Main's
 * snapshot arriving isn't a change: a window opened mid-roast stays quiet.
 */
function stepWatch(stores: Stores, expected: RefObject<number | undefined>): () => SoundStep[] {
  let before = cueState(stores);
  // The charge time of the roast already cued, so each roast hears it once.
  let listenedFor: number | null = null;
  return () => {
    const was = before;
    before = cueState(stores);
    if (!stores.sync.getState().ready) return [];
    const due = stepsReached(was, before);
    const { roast, readings } = stores.roast.getState();
    if (
      roast.chargedAtMs !== listenedFor &&
      listenDue(roast, readings.at(-1)?.values.bt, expected.current)
    ) {
      listenedFor = roast.chargedAtMs;
      due.push('listen-first-crack');
    }
    return due;
  };
}

/** Sounds off, or a step's setting changed: its repeats stop at once. */
function settingsWatch(stores: Stores, repeats: SoundRepeats): () => void {
  let seen = soundsOf(stores);
  return () => {
    const sounds = soundsOf(stores);
    if (!sounds.enabled) repeats.stopAll();
    for (const step of SoundStepSchema.options)
      if (!sameStepSound(sounds.steps[step], seen.steps[step])) repeats.stop(step);
    seen = sounds;
  };
}

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
  const reached = stepWatch(stores, expected);
  const waiting = (step: SoundStep) => () => stillWaiting(step, cueState(stores));
  const check = () => {
    const now = cueState(stores);
    for (const step of SoundStepSchema.options) if (!stillWaiting(step, now)) repeats.stop(step);
    const due = reached();
    const sounds = soundsOf(stores);
    if (!sounds.enabled) return;
    for (const step of due) playStepSound(repeats, chime, step, sounds.steps[step], waiting(step));
  };
  const stops = [
    stores.roast.subscribe(check),
    stores.auto.subscribe(check),
    stores.settings.subscribe(settingsWatch(stores, repeats)),
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
