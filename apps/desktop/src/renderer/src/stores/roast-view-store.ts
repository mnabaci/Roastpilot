import type { TimeWindow } from '@roastpilot/core';
import { createStore, type StoreApi } from 'zustand/vanilla';

/** What the Roast chart's view keeps from one reading to the next (screens/roast/roast-view.ts). */
export interface HeldView {
  window: TimeWindow;
  /** The fitted floor, °C. */
  floorC: number;
}

/**
 * The Roast chart's held window and floor for the roast with this charge time. Kept here, not in
 * the Roast screen, so leaving it mid-roast (Settings, History) and coming back neither shrinks
 * the window nor sets the floor again from expectations that are still loading.
 */
export type RoastViewStore = StoreApi<{
  held: { chargedAtMs: number | null; view: HeldView } | undefined;
}>;

export const createRoastViewStore = (): RoastViewStore => createStore(() => ({ held: undefined }));
