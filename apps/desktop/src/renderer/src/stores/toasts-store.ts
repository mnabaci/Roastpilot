import type { ToastKind, ToastMessage } from '@roastpilot/ui';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface ToastsData {
  /** Oldest first. */
  toasts: readonly ToastMessage[];
  /** The last id given out, so each toast's id is new. */
  lastId: number;
}

export type ToastsStore = StoreApi<ToastsData>;

/** The Toaster shows three; older ones have dropped off by then. */
const MAX_KEPT = 3;

export function createToastsStore(): ToastsStore {
  return createStore(() => ({ toasts: [], lastId: 0 }));
}

/** Adds a toast; the same line again moves to the bottom instead of stacking twice. */
export function addToast(data: ToastsData, kind: ToastKind, text: string): ToastsData {
  const id = data.lastId + 1;
  const others = data.toasts.filter((t) => !(t.kind === kind && t.text === text));
  return { toasts: [...others, { id: String(id), kind, text }].slice(-MAX_KEPT), lastId: id };
}

export function removeToast(data: ToastsData, id: string): ToastsData {
  return { ...data, toasts: data.toasts.filter((t) => t.id !== id) };
}
