import { createStore, type StoreApi } from 'zustand/vanilla';

/** Whether the first snapshot from main has arrived (or failed), so screens can show. */
export type SyncStore = StoreApi<{ ready: boolean }>;

export const createSyncStore = (ready = false): SyncStore => createStore(() => ({ ready }));
