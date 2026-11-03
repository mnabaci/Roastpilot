import type { Logger } from '@roastpilot/core';
import type { RoastpilotApi } from '@roastpilot/shared';
import { createContext, useContext } from 'react';
import type { Stores } from '../stores/stores';

/** What every screen needs, injected so tests can pass a fake api and their own stores. */
export interface AppDeps {
  api: RoastpilotApi;
  stores: Stores;
  logger: Logger;
}

export const AppContext = createContext<AppDeps | null>(null);

export function useDeps(): AppDeps {
  const deps = useContext(AppContext);
  if (!deps) throw new Error('useDeps needs an AppProvider above it');
  return deps;
}
