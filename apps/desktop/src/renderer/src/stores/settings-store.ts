import { DEFAULT_SETTINGS, type Settings } from '@roastpilot/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';

export type SettingsStore = StoreApi<{ settings: Settings }>;

export const createSettingsStore = (settings: Settings = DEFAULT_SETTINGS): SettingsStore =>
  createStore(() => ({ settings }));
