import type { Logger } from '@roastpilot/core';
import type { RoastpilotApi } from '@roastpilot/shared';
import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { AppState } from './app-state';
import type { AppStore } from './app-store';

/** What every screen needs, injected so tests can pass a fake api and their own store. */
export interface AppDeps {
  api: RoastpilotApi;
  store: AppStore;
  logger: Logger;
}

export const AppContext = createContext<AppDeps | null>(null);

export function useDeps(): AppDeps {
  const deps = useContext(AppContext);
  if (!deps) throw new Error('useDeps needs an AppProvider above it');
  return deps;
}

export function useAppState<T>(select: (state: AppState) => T): T {
  return useStore(useDeps().store, select);
}
