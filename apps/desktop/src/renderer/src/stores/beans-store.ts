import { NO_ROAST_SETUP, type Bean, type RoastSetup } from '@roastpilot/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface BeansData {
  beans: Bean[];
  /** What the next roast is of, as main has it. */
  setup: RoastSetup;
}

export type BeansStore = StoreApi<BeansData>;

export const createBeansStore = (beans: Bean[] = [], setup = NO_ROAST_SETUP): BeansStore =>
  createStore(() => ({ beans, setup }));
