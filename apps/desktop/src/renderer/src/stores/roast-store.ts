import { MAX_HISTORY_READINGS } from '@roastpilot/core';
import { READY_ROAST, type Reading, type RoastState } from '@roastpilot/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface RoastData {
  roast: RoastState;
  /** The current roast's readings, like main's history. */
  readings: Reading[];
}

export type RoastStore = StoreApi<RoastData>;

export const createRoastStore = (data: Partial<RoastData> = {}): RoastStore =>
  createStore(() => ({ roast: READY_ROAST, readings: [], ...data }));

/** Keeps at most the history main keeps. */
export function addReading(data: RoastData, reading: Reading): RoastData {
  const readings = [...data.readings, reading];
  if (readings.length > MAX_HISTORY_READINGS)
    readings.splice(0, readings.length - MAX_HISTORY_READINGS);
  return { ...data, readings };
}

/** Preheat starts a new roast, so main drops its readings; do the same here. */
export function setRoast(data: RoastData, roast: RoastState): RoastData {
  const newRoast = roast.phase === 'preheat' && data.roast.phase !== 'preheat';
  return { roast, readings: newRoast ? [] : data.readings };
}
