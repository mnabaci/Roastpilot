import { NO_ROAST_SETUP, type Bean, type RoastSetup, type Supplier } from '@roastpilot/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface BeansData {
  beans: Bean[];
  /** Who you buy from, by name (docs/spec/beans-favourites-ghost.md, Suppliers). */
  suppliers: Supplier[];
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
  suppliers: Supplier[] = [],
): BeansStore => createStore(() => ({ beans, suppliers, setup, currentRoastId }));
