import type { UpdateStatus } from '@roastpilot/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';

/** The installed version and where updates are; null until main has said. */
export interface UpdatesData {
  version: string | null;
  status: UpdateStatus | null;
}

export type UpdatesStore = StoreApi<UpdatesData>;

export const createUpdatesStore = (
  version: string | null = null,
  status: UpdateStatus | null = null,
): UpdatesStore => createStore(() => ({ version, status }));
