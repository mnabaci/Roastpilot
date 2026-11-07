import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSoundRepeats } from './sound-repeats';
import { playStepSound } from './step-sound';
import { voiceLengthMs } from './voices';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('playStepSound', () => {
  it('plays the voice at its volume, as often as set, and says when it is done', () => {
    const chime = { play: vi.fn() };
    const onEnd = vi.fn();
    playStepSound(
      createSoundRepeats(),
      chime,
      'dump-beans',
      { voice: 'bell', volumePct: 40, repeat: 'twice' },
      () => true,
      onEnd,
    );
    expect(chime.play).toHaveBeenCalledWith('bell', 40);
    // The second play follows the bell's own length plus the brief pause.
    vi.advanceTimersByTime(voiceLengthMs('bell') + 300);
    expect(chime.play).toHaveBeenCalledTimes(2);
    expect(onEnd).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('plays no more once the step stops waiting', () => {
    const chime = { play: vi.fn() };
    playStepSound(
      createSoundRepeats(),
      chime,
      'auto-stopped',
      { voice: 'alert', volumePct: 90, repeat: 'thrice' },
      () => false,
    );
    vi.advanceTimersByTime(10_000);
    expect(chime.play).toHaveBeenCalledOnce();
  });
});
