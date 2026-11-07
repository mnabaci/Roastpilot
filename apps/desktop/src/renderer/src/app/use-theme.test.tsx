import { DEFAULT_SETTINGS, type Theme } from '@roastpilot/shared';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { silentLogger } from '@roastpilot/core';
import { createStores } from '../stores/stores';
import { fakeApi, fakeChime } from '../test/render-app';
import { AppProvider } from './AppProvider';
import { useTheme } from './use-theme';

/** A `prefers-color-scheme: dark` query the test can flip, like the computer's own setting. */
function fakeSystem(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => query);
  return {
    listeners,
    set(next: boolean) {
      query.matches = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}

function render(theme: Theme) {
  const root = document.createElement('html');
  const stores = createStores({ ready: true, settings: { ...DEFAULT_SETTINGS, theme } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProvider deps={{ api: fakeApi(), stores, logger: silentLogger, chime: fakeChime() }}>
      {children}
    </AppProvider>
  );
  const view = renderHook(
    () => {
      useTheme(root);
    },
    { wrapper },
  );
  return { root, stores, ...view };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useTheme', () => {
  it('is dark by default, and light once chosen, mid-session too', () => {
    const { root, stores } = render('dark');
    expect(root.dataset.theme).toBe('dark');
    act(() => {
      stores.settings.setState({ settings: { ...DEFAULT_SETTINGS, theme: 'light' } });
    });
    expect(root.dataset.theme).toBe('light');
  });

  it('Match system follows the computer as it switches', () => {
    const system = fakeSystem(false);
    const { root } = render('system');
    expect(root.dataset.theme).toBe('light');
    act(() => {
      system.set(true);
    });
    expect(root.dataset.theme).toBe('dark');
  });

  it('stops following the computer once another theme is chosen, or on unmount', () => {
    const system = fakeSystem(true);
    const { root, stores, unmount } = render('system');
    act(() => {
      stores.settings.setState({ settings: { ...DEFAULT_SETTINGS, theme: 'light' } });
    });
    expect(system.listeners.size).toBe(0);
    expect(root.dataset.theme).toBe('light');
    act(() => {
      stores.settings.setState({ settings: { ...DEFAULT_SETTINGS, theme: 'system' } });
    });
    unmount();
    expect(system.listeners.size).toBe(0);
  });
});
