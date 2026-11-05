import { AUTO_OFF, type AutoStatus, type ProfileEntry } from '@roastpilot/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface AutoData {
  status: AutoStatus;
  /** Built-ins and your own, as main listed them. */
  profiles: ProfileEntry[];
}

export type AutoStore = StoreApi<AutoData>;

export const createAutoStore = (
  status: AutoStatus = AUTO_OFF,
  profiles: ProfileEntry[] = [],
): AutoStore => createStore(() => ({ status, profiles }));
