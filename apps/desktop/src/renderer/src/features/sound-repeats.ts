import type { SoundRepeat, SoundStep } from '@roastpilot/shared';

/** Counted repeats leave this brief pause after the sound ends, so they read as one call. */
export const COUNTED_PAUSE_MS = 300;
/** Until done plays this often while the step still waits… */
export const UNTIL_DONE_GAP_MS = 10_000;
/** …for at most this long after the first play. */
export const UNTIL_DONE_FOR_MS = 60_000;

/**
 * When each play starts, in ms after the first (docs/spec/ui.md, Sounds): counted repeats right
 * after the sound (`soundMs` long) plus a brief pause; until done every 10 s.
 */
export function playTimesMs(repeat: SoundRepeat, soundMs: number): number[] {
  const counted = soundMs + COUNTED_PAUSE_MS;
  const every = (gapMs: number, count: number) =>
    Array.from({ length: count }, (_, i) => i * gapMs);
  switch (repeat) {
    case 'once':
      return every(counted, 1);
    case 'twice':
      return every(counted, 2);
    case 'thrice':
      return every(counted, 3);
    case 'until-done':
      return every(UNTIL_DONE_GAP_MS, UNTIL_DONE_FOR_MS / UNTIL_DONE_GAP_MS + 1);
  }
}

/** The timer calls the repeats need; the window's own by default, fake ones in tests. */
export interface Timers {
  set(run: () => void, ms: number): ReturnType<typeof setTimeout>;
  clear(handle: ReturnType<typeof setTimeout>): void;
}

const windowTimers: Timers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => {
    clearTimeout(handle);
  },
};

/** Each step's repeats; one timer per step at most, so two plays of a step never overlap. */
export interface SoundRepeats {
  /**
   * Plays now, then at `timesMs` (playTimesMs) while `waiting()`; restarts a step already
   * repeating. `onEnd` runs once no play is left to come, unless stopped first.
   */
  start(
    step: SoundStep,
    timesMs: readonly number[],
    play: () => void,
    waiting: () => boolean,
    onEnd?: () => void,
  ): void;
  /** Cancels a step's remaining plays. */
  stop(step: SoundStep): void;
  /** Cancels every step's remaining plays. */
  stopAll(): void;
}

export function createSoundRepeats(timers: Timers = windowTimers): SoundRepeats {
  const next = new Map<SoundStep, ReturnType<typeof setTimeout>>();
  const stop = (step: SoundStep) => {
    const handle = next.get(step);
    if (handle === undefined) return;
    timers.clear(handle);
    next.delete(step);
  };
  return {
    start(step, times, play, waiting, onEnd = () => undefined) {
      stop(step);
      const schedule = (index: number) => {
        const atMs = times[index];
        const previousMs = times[index - 1];
        if (atMs === undefined || previousMs === undefined) {
          next.delete(step);
          onEnd();
          return;
        }
        const handle = timers.set(() => {
          next.delete(step);
          if (!waiting()) {
            onEnd();
            return;
          }
          play();
          schedule(index + 1);
        }, atMs - previousMs);
        next.set(step, handle);
      };
      play();
      schedule(1);
    },
    stop,
    stopAll() {
      for (const step of [...next.keys()]) stop(step);
    },
  };
}
