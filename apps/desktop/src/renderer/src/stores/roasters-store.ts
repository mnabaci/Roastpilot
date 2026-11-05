import type { Roaster } from '@roastpilot/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';

export type RoastersStore = StoreApi<{ roasters: Roaster[] }>;

export const createRoastersStore = (roasters: Roaster[] = []): RoastersStore =>
  createStore(() => ({ roasters }));

/** The active record; undefined only before main has listed them. */
export const activeRoaster = (roasters: readonly Roaster[]): Roaster | undefined =>
  roasters.find((r) => r.active) ?? roasters[0];
