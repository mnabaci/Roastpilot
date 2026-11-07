import { describe, expect, it, vi } from 'vitest';
import { startSwapHelper, type DetachedChild } from './swap-helper';

const REQUEST = {
  pid: 4242,
  installed: '/Applications/Roastpilot.app',
  staged: '/Users/me/Library/Application Support/Roastpilot/updates/0.2.0/Roastpilot.app',
  relaunch: true,
  log: '/Users/me/Library/Application Support/Roastpilot/updates/install.log',
};

function fakeChild() {
  let onError: ((error: Error) => void) | undefined;
  const child: DetachedChild & { fail: (e: Error) => void } = {
    on: vi.fn((_event: 'error', listener: (error: Error) => void) => {
      onError = listener;
    }),
    unref: vi.fn(),
    fail: (e) => onError?.(e),
  };
  return child;
}

describe('startSwapHelper', () => {
  it('runs the script with sh, each value its own argument, and lets go of it', () => {
    const child = fakeChild();
    const spawn = vi.fn(() => child);
    const result = startSwapHelper(
      '/R.app/Contents/Resources/mac-update-swap.sh',
      REQUEST,
      spawn,
      vi.fn(),
    );
    expect(result).toEqual({ ok: true, value: undefined });
    expect(spawn).toHaveBeenCalledWith('/bin/sh', [
      '/R.app/Contents/Resources/mac-update-swap.sh',
      '4242',
      REQUEST.installed,
      REQUEST.staged,
      '1',
      REQUEST.log,
    ]);
    expect(child.unref).toHaveBeenCalled();
  });

  it('without relaunch passes 0', () => {
    const spawn = vi.fn((_command: string, _args: readonly string[]) => fakeChild());
    startSwapHelper('/s.sh', { ...REQUEST, relaunch: false }, spawn, vi.fn());
    expect(spawn.mock.calls[0]?.[1]?.[4]).toBe('0');
  });

  it('a spawn that throws is a failure; a later error event goes to onError', () => {
    const throwing = vi.fn(() => {
      throw new Error('spawn EAGAIN');
    });
    expect(startSwapHelper('/s.sh', REQUEST, throwing, vi.fn())).toEqual({
      ok: false,
      error: { message: 'spawn EAGAIN' },
    });
    const child = fakeChild();
    const onError = vi.fn();
    startSwapHelper('/s.sh', REQUEST, () => child, onError);
    child.fail(new Error('spawn /bin/sh ENOENT'));
    expect(onError).toHaveBeenCalledWith(new Error('spawn /bin/sh ENOENT'));
  });
});
