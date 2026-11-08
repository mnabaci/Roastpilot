import type { TimeWindow } from '@roastpilot/core';
import type { RoastSummary } from '@roastpilot/shared';
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
  /**
   * The finished roast's card (FinishedRoastCard): the roast you pressed Done on, and the roast
   * as last listed, so coming back to Roast neither shows it again nor hides it while History loads.
   */
  doneRoastId: number | undefined;
  finished: RoastSummary | undefined;
}>;

export const createRoastViewStore = (): RoastViewStore =>
  createStore(() => ({ held: undefined, doneRoastId: undefined, finished: undefined }));
