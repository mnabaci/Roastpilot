import type { TemperatureUnit } from '@roastpilot/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { BeanDraft } from '../screens/beans/bean-draft';
import type { RoasterDraft } from '../screens/roasters/roaster-draft';

/**
 * Bean and roaster edits not saved yet, by id ("new" for a bean being added), as Profiles keeps
 * its drafts (auto-store.ts): they last until Save, Cancel or quitting, so moving to another
 * screen or record and back finds the edit as you left it (docs/spec/ui.md, Read and edit).
 */
export interface EditsData {
  beans: Readonly<Record<string, BeanDraft>>;
  /** Typed in the unit shown then; read back in the unit shown now. */
  roasters: Readonly<Record<string, { draft: RoasterDraft; unit: TemperatureUnit }>>;
}

export type EditsStore = StoreApi<EditsData>;

export const createEditsStore = (): EditsStore => createStore(() => ({ beans: {}, roasters: {} }));

/** The kept edits without `id`'s. */
export const without = <T>(
  kept: Readonly<Record<string, T>>,
  id: string | number,
): Record<string, T> =>
  Object.fromEntries(Object.entries(kept).filter(([key]) => key !== String(id)));
