import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { createWebAudioChimePlayer } from './chime';
import { PEAK } from './voices';

/** An AudioContext that records each layer started (wave and pitch) and each peak gain. */
function fakeContext(state: AudioContextState = 'running', resume = () => Promise.resolve()) {
  const started: string[] = [];
  const peaks: number[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn((value: number) => {
      peaks.push(value);
    }),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const context = {
    state,
    currentTime: 0,
    destination: {},
    resume: vi.fn(resume),
    createGain: () => ({ gain: param(), connect: (to: unknown) => to }),
    createDynamicsCompressor: () => ({ connect: (to: unknown) => to }),
    createOscillator: () => {
      const oscillator = {
        type: 'sine',
        frequency: param(),
        connect: (to: unknown) => to,
        start: vi.fn(() => {
          started.push(
            `${oscillator.type} ${String(Math.round(oscillator.frequency.value * 100) / 100)}`,
          );
        }),
        stop: vi.fn(),
      };
      return oscillator;
    },
  };
  return { context: context as unknown as AudioContext, started, peaks, resume: context.resume };
}

function setup(makeContext: () => AudioContext | undefined) {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'sound');
  return { entries, player: createWebAudioChimePlayer(logger, makeContext) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createWebAudioChimePlayer', () => {
  it('makes the audio context only when the first sound plays', async () => {
    const fake = fakeContext();
    const make = vi.fn(() => fake.context);
    const { player } = setup(make);
    expect(make).not.toHaveBeenCalled();
    player.play('chime', 80);
    player.play('ping', 70);
    await settle();
    expect(make).toHaveBeenCalledTimes(1);
  });

  it('plays each voice with its notes and timbre', async () => {
    const fake = fakeContext();
    const { player } = setup(() => fake.context);
    player.play('chime', 100);
    player.play('ping', 100);
    player.play('alert', 100);
    await settle();
    expect(fake.started).toEqual([
      'triangle 660',
      'sine 1320',
      'triangle 880',
      'sine 1760',
      'triangle 587',
      'sine 1174',
      'triangle 330',
      'sine 660',
      'triangle 330',
      'sine 660',
    ]);
    fake.started.length = 0;
    player.play('bell', 100);
    player.play('marimba', 100);
    player.play('beep', 100);
    await settle();
    expect(fake.started).toEqual([
      'sine 784',
      'sine 2163.84',
      'sine 4233.6',
      'sine 523',
      'sine 2092',
      'sine 659',
      'sine 2636',
      'square 1000',
      'square 1000',
    ]);
  });

  it('scales the peak by the volume', async () => {
    const fake = fakeContext();
    const { player } = setup(() => fake.context);
    player.play('ping', 50);
    await settle();
    expect(fake.peaks[0]).toBeCloseTo(PEAK.ping / 2);
    expect(fake.peaks[1]).toBeCloseTo((PEAK.ping / 2) * 0.35);
  });

  it('None, or 0 %, plays nothing and opens no context', async () => {
    const make = vi.fn(() => fakeContext().context);
    const { player } = setup(make);
    player.play('none', 100);
    player.play('chime', 0);
    await settle();
    expect(make).not.toHaveBeenCalled();
  });

  it('resumes a suspended context before playing', async () => {
    const fake = fakeContext('suspended');
    const { player } = setup(() => fake.context);
    player.play('ping', 70);
    await settle();
    expect(fake.resume).toHaveBeenCalled();
    expect(fake.started).toEqual(['triangle 587', 'sine 1174']);
  });

  it('logs once, never throws, when the window blocks sound', async () => {
    const fake = fakeContext('suspended', () => Promise.reject(new Error('not allowed')));
    const { player, entries } = setup(() => fake.context);
    player.play('chime', 80);
    player.play('chime', 80);
    await settle();
    expect(fake.started).toEqual([]);
    expect(entries.filter((e) => e.event === 'sound.cannot-play')).toHaveLength(1);
  });

  it('logs once when there is no Web Audio, or making the context fails', () => {
    const none = setup(() => undefined);
    none.player.play('chime', 80);
    none.player.play('alert', 90);
    expect(none.entries.filter((e) => e.event === 'sound.cannot-play')).toHaveLength(1);
    const failing = setup(() => {
      throw new Error('no device');
    });
    expect(() => {
      failing.player.play('chime', 80);
    }).not.toThrow();
    expect(failing.entries.map((e) => e.event)).toEqual(['sound.cannot-play']);
  });
});
