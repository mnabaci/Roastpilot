import type { SettingsStore } from '@roastpilot/core';
import { ok, type Result, type Settings, type SettingsWriteError } from '@roastpilot/shared';

/** Loads settings once, then serves them from memory; saves go to the store first. */
export class SettingsService {
  readonly #store: SettingsStore;
  #current: Promise<Settings> | undefined;

  constructor(store: SettingsStore) {
    this.#store = store;
  }

  get(): Promise<Settings> {
    this.#current ??= this.#store.load();
    return this.#current;
  }

  /** Saves settings already validated at the boundary; the cached copy changes only if the save worked. */
  async set(settings: Settings): Promise<Result<Settings, SettingsWriteError>> {
    const saved = await this.#store.save(settings);
    if (!saved.ok) return saved;
    this.#current = Promise.resolve(settings);
    return ok(settings);
  }
}
