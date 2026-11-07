import type { SoundRepeat } from '@roastpilot/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSoundRepeats, playTimesMs } from './sound-repeats';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Starts one step and records when each play happened, in ms from the start. */
function run(repeat: SoundRepeat, waiting: () => boolean = () => true) {
  const repeats = createSoundRepeats();
  const startMs = Date.now();
  const at: number[] = [];
  const play = () => at.push(Date.now() - startMs);
  repeats.start('beans-in', repeat, play, waiting);
  return { repeats, at, play };
}

describe('playTimesMs', () => {
  it('counted repeats are 3 s apart; until done every 10 s for a minute', () => {
    expect(playTimesMs('once')).toEqual([0]);
    expect(playTimesMs('twice')).toEqual([0, 3_000]);
    expect(playTimesMs('thrice')).toEqual([0, 3_000, 6_000]);
    expect(playTimesMs('until-done')).toEqual([0, 10_000, 20_000, 30_000, 40_000, 50_000, 60_000]);
  });
});

describe('createSoundRepeats', () => {
  it.each<[SoundRepeat, number[]]>([
    ['once', [0]],
    ['twice', [0, 3_000]],
    ['thrice', [0, 3_000, 6_000]],
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
    vi.advanceTimersByTime(3_000);
    waiting = false;
    vi.advanceTimersByTime(10_000);
    expect(at).toEqual([0, 3_000]);
  });

  it('stop and stopAll cancel what is still to come, leaving no timers', () => {
    const { repeats, at } = run('until-done');
    const other: number[] = [];
    repeats.start(
      'dump-beans',
      'thrice',
      () => other.push(Date.now()),
      () => true,
    );
    repeats.stop('beans-in');
    vi.advanceTimersByTime(3_000);
    expect(at).toEqual([0]);
    expect(other).toHaveLength(2);
    repeats.stopAll();
    vi.advanceTimersByTime(60_000);
    expect(other).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starting a step again restarts it, so two plays of one step never overlap', () => {
    const { repeats, at, play } = run('thrice');
    vi.advanceTimersByTime(1_000);
    repeats.start('beans-in', 'thrice', play, () => true);
    vi.advanceTimersByTime(60_000);
    // The first run's 3 s and 6 s plays never come; the second one's do.
    expect(at).toEqual([0, 1_000, 4_000, 7_000]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
