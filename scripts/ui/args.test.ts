import { describe, expect, it } from 'vitest';
import { parseUiArgs } from './args.ts';

describe('parseUiArgs', () => {
  it('evaluates one expression on the default port', () => {
    expect(parseUiArgs(['eval', 'document.title'])).toEqual({
      ok: true,
      value: { port: 9222, command: { kind: 'eval', expression: 'document.title' } },
    });
  });

  it('clicks several labels in order, on another port', () => {
    expect(parseUiArgs(['click', 'Settings', 'Light', '--port', '9333'])).toEqual({
      ok: true,
      value: { port: 9333, command: { kind: 'click', labels: ['Settings', 'Light'] } },
    });
  });

  it('scrolls every scroller without a heading', () => {
    expect(parseUiArgs(['scroll-end'])).toMatchObject({
      ok: true,
      value: { command: { kind: 'scroll-end', heading: undefined } },
    });
  });

  it('shoots at the minimum window by default', () => {
    expect(parseUiArgs(['shot', 'a.png'])).toMatchObject({
      ok: true,
      value: { command: { kind: 'shot', file: 'a.png', width: 960, height: 640, scale: 1 } },
    });
  });

  it('shoots at a given size and scale, scrolled to the end', () => {
    const args = ['shot', 'b.png', '--width', '1600', '--height', '1000', '--scale', '2'];
    expect(parseUiArgs([...args, '--scroll-end', 'Profiles'])).toMatchObject({
      ok: true,
      value: {
        command: { width: 1600, height: 1000, scale: 2, scrollEnd: 'Profiles' },
      },
    });
  });

  it.each([
    [[], 'No command'],
    [['zoom'], 'Unknown command: zoom'],
    [['eval'], 'eval takes one expression'],
    [['click'], 'click takes at least one label'],
    [['shot'], 'shot takes one file path'],
    [['shot', 'a.png', '--width=-5'], '--width must be a positive number'],
    [['eval', '1', '--port', 'x'], '--port must be a positive number'],
    [['eval', '1', '--nope'], "Unknown option '--nope'"],
  ])('refuses %j', (argv, error) => {
    const result = parseUiArgs(argv);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(error);
  });
});
