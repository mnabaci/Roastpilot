import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReducedMotion } from './use-reduced-motion';

/** A stand-in for the system setting, changed with `set`. */
function systemSetting(reduce: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: reduce,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', (q: string) => {
    expect(q).toBe('(prefers-reduced-motion: reduce)');
    return query;
  });
  return {
    set: (next: boolean) => {
      query.matches = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}

describe('useReducedMotion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('follows the system setting as it changes', () => {
    const setting = systemSetting(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
    act(() => {
      setting.set(false);
    });
    expect(result.current).toBe(false);
  });

  it('is off where the page can not ask', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});
