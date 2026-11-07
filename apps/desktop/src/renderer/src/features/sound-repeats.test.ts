import type { SoundRepeat } from '@roastpilot/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSoundRepeats, playTimesMs } from './sound-repeats';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** A 500 ms sound, so counted repeats start 800 ms apart (500 ms + the 300 ms pause). */
const SOUND_MS = 500;

/** Starts one step and records when each play happened, in ms from the start. */
function run(repeat: SoundRepeat, waiting: () => boolean = () => true) {
  const repeats = createSoundRepeats();
  const startMs = Date.now();
  const at: number[] = [];
  const play = () => at.push(Date.now() - startMs);
  repeats.start('beans-in', playTimesMs(repeat, SOUND_MS), play, waiting);
  return { repeats, at, play };
}

describe('playTimesMs', () => {
  it('counted repeats follow the sound after a brief pause; until done every 10 s for a minute', () => {
    expect(playTimesMs('once', SOUND_MS)).toEqual([0]);
    expect(playTimesMs('twice', SOUND_MS)).toEqual([0, 800]);
    expect(playTimesMs('thrice', SOUND_MS)).toEqual([0, 800, 1_600]);
    expect(playTimesMs('thrice', 1_200)).toEqual([0, 1_500, 3_000]);
    expect(playTimesMs('until-done', SOUND_MS)).toEqual([
      0, 10_000, 20_000, 30_000, 40_000, 50_000, 60_000,
    ]);
  });
});

describe('createSoundRepeats', () => {
  it.each<[SoundRepeat, number[]]>([
    ['once', [0]],
    ['twice', [0, 800]],
    ['thrice', [0, 800, 1_600]],
    ['until-done', [0, 10_000, 20_000, 30_000, 40_000, 50_000, 60_000]],
  ])('%s plays at %j and then stops', (repeat, times) => {
    const { at } = run(repeat);
    vi.advanceTimersByTime(5 * 60_000);
    expect(at).toEqual(times);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('until done stops once the step no longer waits', () => {
    let waiting = true;
    const { at } = run('until-done', () => waiting);
    vi.advanceTimersByTime(25_000);
    waiting = false;
    vi.advanceTimersByTime(60_000);
    expect(at).toEqual([0, 10_000, 20_000]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('counted repeats stop early once the step no longer waits', () => {
    let waiting = true;
    const { at } = run('thrice', () => waiting);
    vi.advanceTimersByTime(800);
    waiting = false;
    vi.advanceTimersByTime(10_000);
    expect(at).toEqual([0, 800]);
  });

  it('stop and stopAll cancel what is still to come, leaving no timers', () => {
    const { repeats, at } = run('until-done');
    const other: number[] = [];
    repeats.start(
      'dump-beans',
      playTimesMs('thrice', SOUND_MS),
      () => other.push(Date.now()),
      () => true,
    );
    repeats.stop('beans-in');
    vi.advanceTimersByTime(800);
    expect(at).toEqual([0]);
    expect(other).toHaveLength(2);
    repeats.stopAll();
    vi.advanceTimersByTime(60_000);
    expect(other).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('onEnd runs once nothing is left to come, or the step stops waiting; not on stop', () => {
    const ends: string[] = [];
    const repeats = createSoundRepeats();
    const play = () => undefined;
    repeats.start(
      'beans-in',
      playTimesMs('twice', SOUND_MS),
      play,
      () => true,
      () => ends.push('done'),
    );
    expect(ends).toEqual([]);
    vi.advanceTimersByTime(800);
    expect(ends).toEqual(['done']);
    repeats.start(
      'beans-in',
      playTimesMs('until-done', SOUND_MS),
      play,
      () => false,
      () => ends.push('left'),
    );
    vi.advanceTimersByTime(10_000);
    expect(ends).toEqual(['done', 'left']);
    repeats.start(
      'beans-in',
      playTimesMs('thrice', SOUND_MS),
      play,
      () => true,
      () => ends.push('stopped'),
    );
    repeats.stop('beans-in');
    vi.advanceTimersByTime(60_000);
    expect(ends).toEqual(['done', 'left']);
  });

  it('starting a step again restarts it, so two plays of one step never overlap', () => {
    const { repeats, at, play } = run('thrice');
    vi.advanceTimersByTime(500);
    repeats.start('beans-in', playTimesMs('thrice', SOUND_MS), play, () => true);
    vi.advanceTimersByTime(60_000);
    // The first run's later plays never come; the second one's do.
    expect(at).toEqual([0, 500, 1_300, 2_100]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
