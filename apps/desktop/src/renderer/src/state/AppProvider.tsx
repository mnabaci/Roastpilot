import type { ReactNode } from 'react';
import { AppContext, type AppDeps } from './app-context';

export function AppProvider({ deps, children }: { deps: AppDeps; children: ReactNode }) {
  return <AppContext.Provider value={deps}>{children}</AppContext.Provider>;
}
