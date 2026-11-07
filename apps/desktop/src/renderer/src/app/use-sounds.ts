import type { SoundStep } from '@roastpilot/shared';
import { useEffect, useMemo, useRef } from 'react';
import {
  expectedFirstCrackC,
  listenDue,
  stepsReached,
  type CueState,
} from '../features/sound-cues';
import { useRoastList } from '../screens/history/use-roast-list';
import { activeRoaster } from '../stores/roasters-store';
import type { Stores } from '../stores/stores';
import { useRoasters } from '../stores/use-stores';
import { useDeps } from './app-context';

const cueState = (stores: Stores): CueState => ({
  roast: stores.roast.getState().roast,
  auto: stores.auto.getState().status,
});

/**
 * Plays each step's sound (docs/spec/ui.md, Sounds): once per change, never per reading, and
 * nothing while Sounds is off. Mounted once, in the app shell, so one window plays them.
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

  useEffect(() => {
    let before = cueState(stores);
    // The charge time of the roast already cued, so each roast hears it once.
    let listenedFor: number | null = null;
    const check = () => {
      const after = cueState(stores);
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
      const { sounds } = stores.settings.getState().settings;
      if (!sounds.enabled) return;
      for (const step of due) chime.play(sounds.steps[step].voice, sounds.steps[step].volumePct);
    };
    const stops = [stores.roast.subscribe(check), stores.auto.subscribe(check)];
    return () => {
      for (const stop of stops) stop();
    };
  }, [stores, chime]);
}
