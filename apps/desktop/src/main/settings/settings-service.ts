import type { SettingsStore } from '@roastpilot/core';
import {
  DEFAULT_SETTINGS,
  ok,
  type Result,
  type Settings,
  type SettingsWriteError,
} from '@roastpilot/shared';

/** Loads settings once, then serves them from memory; saves go to the store first. */
export class SettingsService {
  readonly #store: SettingsStore;
  #current: Promise<Settings> | undefined;
  #latest: Settings = DEFAULT_SETTINGS;

  constructor(store: SettingsStore) {
    this.#store = store;
  }

  get(): Promise<Settings> {
    this.#current ??= this.#store.load().then((settings) => {
      this.#latest = settings;
      return settings;
    });
    return this.#current;
  }

  /** The settings loaded or saved last; the defaults until the first load finishes. */
  get latest(): Settings {
    return this.#latest;
  }

  /** Saves settings already validated at the boundary; the cached copy changes only if the save worked. */
  async set(settings: Settings): Promise<Result<Settings, SettingsWriteError>> {
    const saved = await this.#store.save(settings);
    if (!saved.ok) return saved;
    this.#current = Promise.resolve(settings);
    this.#latest = settings;
    return ok(settings);
  }
}
