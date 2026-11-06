import { NO_ROAST_SETUP, type Bean, type RoastSetup } from '@roastpilot/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface BeansData {
  beans: Bean[];
  /** What the next roast is of, as main has it. */
  setup: RoastSetup;
  /** The roast on the Roast screen, as saved; null with none. */
  currentRoastId: number | null;
}

export type BeansStore = StoreApi<BeansData>;

export const createBeansStore = (
  beans: Bean[] = [],
  setup = NO_ROAST_SETUP,
  currentRoastId: number | null = null,
): BeansStore => createStore(() => ({ beans, setup, currentRoastId }));
