import { createStore, type StoreApi } from 'zustand/vanilla';
import { INITIAL_STATE, type AppState } from './app-state';

export type AppStore = StoreApi<AppState>;

export function createAppStore(initial: AppState = INITIAL_STATE): AppStore {
  return createStore<AppState>()(() => initial);
}

/** Applies a pure update from app-state.ts to the store. */
export function update<P>(
  store: AppStore,
  apply: (state: AppState, payload: P) => AppState,
  payload: P,
): void {
  store.setState((state) => apply(state, payload), true);
}
